package main

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/emanuelef/github-repo-activity-stats/repostats"
	"github.com/emanuelef/github-repo-activity-stats/stats"
	_ "github.com/joho/godotenv/autoload"
	"golang.org/x/oauth2"
	"gopkg.in/yaml.v2"
)

const (
	apiURL        = "https://api.github.com/repos/awesome-selfhosted/awesome-selfhosted-data/contents/software"
	GitHubBaseUrl = "https://github.com/"
)

var githubToken = os.Getenv("PAT")

type GitHubFile struct {
	Name        string `json:"name"`
	DownloadURL string `json:"download_url"`
}

type SoftwareEntry struct {
	Name          string   `yaml:"name"`
	SourceCodeURL string   `yaml:"source_code_url"`
	Tags          []string `yaml:"tags"`
}

func main() {
	ctx := context.Background()

	starsHistory := map[string][]stats.StarsPerDay{}
	commitsHistory := map[string][]stats.CommitsPerDay{}

	currentTime := time.Now()

	files, err := listYAMLFiles(ctx)
	if err != nil {
		log.Fatalf("Failed to list YAML files: %v", err)
	}

	if githubToken == "" {
		log.Fatal("GITHUB_TOKEN is not set")
	}

	tokenSource := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: githubToken},
	)

	oauthClient := oauth2.NewClient(context.Background(), tokenSource)
	client := repostats.NewClientGQL(oauthClient)

	outputFile, err := os.Create("analysis-latest.csv")
	if err != nil {
		log.Fatal(err)
	}

	defer outputFile.Close()

	csvWriter := csv.NewWriter(outputFile)
	defer csvWriter.Flush()

	headerRow := []string{
		"repo", "stars", "new-stars-last-30d", "new-stars-last-14d",
		"new-stars-last-7d", "new-stars-last-24H", "stars-per-mille-30d",
		"days-last-star", "days-last-commit",
		"days-since-creation", "mentionable-users",
		"language",
		"archived",
		"liveness",
		"unique-contributors",
		"new-commits-last-30d",
		"tag",
	}

	err = csvWriter.Write(headerRow)

	if err != nil {
		log.Fatal(err)
	}

	for count, file := range files {
		if file.DownloadURL == "" {
			continue
		}

		content, err := downloadFile(ctx, file.DownloadURL)
		if err != nil {
			log.Printf("Failed to download file %s: %v", file.Name, err)
			continue
		}

		var entry SoftwareEntry
		if err := yaml.Unmarshal(content, &entry); err != nil {
			log.Printf("Failed to parse YAML for file %s: %v", file.Name, err)
			continue
		}

		if entry.SourceCodeURL != "" && strings.Contains(entry.SourceCodeURL, "github.com") {
			fmt.Printf("%s -> %s\n", entry.Name, entry.SourceCodeURL)

			var firstTag string
			if len(entry.Tags) > 0 {
				firstTag = entry.Tags[0]
				if strings.Contains(firstTag, " - ") {
					firstTag = strings.Split(firstTag, " - ")[0]
				}
				firstTag = strings.ReplaceAll(firstTag, "\"", "")
			} else {
				firstTag = "unknown"
			}

			repo := strings.TrimPrefix(entry.SourceCodeURL, GitHubBaseUrl)
			repo = strings.TrimSuffix(repo, "/")
			fmt.Printf("Repo: %s\n", repo)

			result, err := client.GetAllStats(ctx, repo)
			if err != nil {
				fmt.Println("retrying after 2 minutes")
				time.Sleep(2 * time.Minute)
				result, err = client.GetAllStats(ctx, repo)
				if err != nil {
					// log.Fatalf("Error getting all stats %s %v", repo, err)
					return
				}
			}

			fmt.Println(result)

			daysSinceLastStar := int(currentTime.Sub(result.LastStarDate).Hours() / 24)
			daysSinceLastCommit := int(currentTime.Sub(result.LastCommitDate).Hours() / 24)
			daysSinceCreation := int(currentTime.Sub(result.CreatedAt).Hours() / 24)

			if result.Language == "" {
				result.Language = "unknown"
			}

			err = csvWriter.Write([]string{
				repo,
				fmt.Sprintf("%d", result.Stars),
				fmt.Sprintf("%d", result.StarsHistory.AddedLast30d),
				fmt.Sprintf("%d", result.StarsHistory.AddedLast14d),
				fmt.Sprintf("%d", result.StarsHistory.AddedLast7d),
				fmt.Sprintf("%d", result.StarsHistory.AddedLast24H),
				fmt.Sprintf("%.3f", result.StarsHistory.AddedPerMille30d),
				fmt.Sprintf("%d", daysSinceLastStar),
				fmt.Sprintf("%d", daysSinceLastCommit),
				fmt.Sprintf("%d", daysSinceCreation),
				fmt.Sprintf("%d", result.MentionableUsers),
				result.Language,
				fmt.Sprintf("%t", result.Archived),
				fmt.Sprintf("%.3f", result.LivenessScore),
				fmt.Sprintf("%d", result.DifferentAuthors),
				fmt.Sprintf("%d", result.CommitsHistory.AddedLast30d),
				firstTag,
			})

			if err != nil {
				log.Fatal(err)
			}

			starsHistory[repo] = result.StarsTimeline
			commitsHistory[repo] = result.CommitsTimeline
		}

		if count == 100 {
			break
		}
	}
	jsonData, _ := json.MarshalIndent(starsHistory, "", " ")
	_ = os.WriteFile("stars-history-30d.json", jsonData, 0o644)

	commitsJsonData, _ := json.MarshalIndent(commitsHistory, "", " ")
	_ = os.WriteFile("commits-history-30d.json", commitsJsonData, 0o644)

	elapsed := time.Since(currentTime)
	log.Printf("Took %s\n", elapsed)
}

func listYAMLFiles(ctx context.Context) ([]GitHubFile, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return nil, err
	}

	if githubToken != "" {
		req.Header.Set("Authorization", "token "+githubToken)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to list files: %s", string(bodyBytes))
	}

	var files []GitHubFile
	if err := json.NewDecoder(resp.Body).Decode(&files); err != nil {
		return nil, err
	}

	// Only return .yml files
	var ymlFiles []GitHubFile
	for _, file := range files {
		if strings.HasSuffix(file.Name, ".yml") {
			ymlFiles = append(ymlFiles, file)
		}
	}

	return ymlFiles, nil
}

func downloadFile(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	if githubToken != "" {
		req.Header.Set("Authorization", "token "+githubToken)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to download file: %s", string(bodyBytes))
	}

	return io.ReadAll(resp.Body)
}
