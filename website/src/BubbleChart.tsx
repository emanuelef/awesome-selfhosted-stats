import React, { useState, useEffect } from "react";
import Plot from "react-plotly.js";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Papa from "papaparse";

const fullStarsHistoryURL =
  "https://emanuelef.github.io/daily-stars-explorer/#";

const csvURL =
  "https://raw.githubusercontent.com/emanuelef/awesome-selfhosted-stats/main/analysis-latest.csv";

const LanguageColoursURL =
  "https://raw.githubusercontent.com/ozh/github-colors/master/colors.json";

const logBase = (n, base) => Math.log(n) / Math.log(base);

const getColorFromValue = (value) => {
  // Normalize the value to a scale from 0 to 1
  const normalizedValue = value / 100;

  // Define the colors for the gradient
  const colors = [
    { percent: 0, color: "#D9534F" }, // Adjusted Red
    { percent: 0.5, color: "#FFA500" }, // Orange
    { percent: 1, color: "#5CB85C" }, // Adjusted Green
  ];

  // Find the two colors to interpolate between
  let startColor, endColor;
  for (let i = 0; i < colors.length - 1; i++) {
    if (
      normalizedValue >= colors[i].percent &&
      normalizedValue <= colors[i + 1].percent
    ) {
      startColor = colors[i];
      endColor = colors[i + 1];
      break;
    }
  }

  // Interpolate between the two colors
  const ratio =
    (normalizedValue - startColor.percent) /
    (endColor.percent - startColor.percent);
  const rgbColor = interpolateColor(startColor.color, endColor.color, ratio);

  console.log(value);
  console.log(rgbColor);

  return rgbColor;
};

const interpolateColor = (startColor, endColor, ratio) => {
  const startRGB = hexToRgb(startColor);
  const endRGB = hexToRgb(endColor);

  const interpolatedRGB = startRGB.map((channel, index) =>
    Math.round(channel + ratio * (endRGB[index] - channel))
  );

  return `rgb(${interpolatedRGB.join(", ")})`;
};

const hexToRgb = (hex) => {
  const hexDigits = hex.slice(1).match(/.{1,2}/g);
  return hexDigits.map((value) => parseInt(value, 16));
};

const mapLivenessToColor = (liveness) => {
  return getColorFromValue(liveness) || "rgb(0, 0, 0)"; // Default to black if not found
};

const clickActions = [
  { label: "GH Repo", action: "gh" },
  { label: "Last 30d stars", action: "30d" },
  { label: "Full Star history", action: "full" },
];

const axisMetrics = [
  { label: "Stars Last 7 Days", metric: "new-stars-last-7d" },
  { label: "Stars Last 14 Days", metric: "new-stars-last-14d" },
  { label: "Stars Last 30 Days", metric: "new-stars-last-30d" },
  { label: "Mentionable Users", metric: "mentionable-users" },
  { label: "Total Stars", metric: "stars" },
  { label: "New Stars 30d‰", metric: "stars-per-mille-30d" },
  { label: "Age", metric: "days-since-creation" },
  { label: "Unique contributors 30d", metric: "unique-contributors" },
  { label: "Commits Last 30 Days", metric: "new-commits-last-30d" },
];

const sizeMetrics = [
  { label: "Stars", metric: "stars" },
  { label: "Same", metric: "same" },
  { label: "Liveness", metric: "liveness" },
  { label: "Commits Last 30 Days", metric: "new-commits-last-30d" },
  { label: "Unique authors Last 30 Days", metric: "unique-contributors" },
];

const bubbleColour = [
  { label: "Language", metric: "language" },
  { label: "Liveness", metric: "liveness" },
];

const formatStars = (stars) => {
  if (stars >= 1000) {
    return `${(stars / 1000).toFixed(1)}k`;
  } else {
    return stars.toString();
  }
};

const calculateAge = (days) => {
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const remainingDays = days % 30;

  return `${years !== 0 ? `${years}y ` : ""}${months !== 0 ? `${months}m ` : ""
    }${remainingDays}d`;
};

const BubbleChart = ({ dataRows }) => {
  const [maxDaysLastCommit, setMaxDaysLastCommit] = useState("30");
  const [minStars, setMinStars] = useState("10");
  const [minMentionableUsers, setMinMentionableUsers] = useState("1");
  const [data, setData] = useState([]);
  const [selectedAction, setSelectedAction] = useState(clickActions[0].action);

  const [selectedXAxis, setSelectedXAxis] = useState(axisMetrics[0]);
  const [selectedYAxis, setSelectedYAxis] = useState(axisMetrics[3]);

  const [selectedSize, setSelectedSize] = useState(sizeMetrics[0]);

  const [selectedBubbleColour, setSelectedBubbleColour] = useState(
    bubbleColour[0]
  );

  const [colours, setColours] = useState({});

  const handleInputChange = (event, setStateFunction) => {
    const inputText = event.target.value;

    // Use a regular expression to check if the input contains only digits
    if (/^\d*$/.test(inputText)) {
      setStateFunction(inputText);
    }
  };

  const handleBubbleClick = (event) => {
    const pointIndex = event.points[0].pointIndex;
    const clickedRepo = event.points[0].data.repo[pointIndex];

    let url = `https://github.com/${clickedRepo}`;

    switch (selectedAction) {
      case "gh":
        window.open(url, "_blank");
        break;

      case "30d":
        url = `./#/starstimeline/${clickedRepo}`;
        window.location.href = url;
        break;

      case "full":
        url = `${fullStarsHistoryURL}/${clickedRepo}`;
        window.open(url, "_blank");
        break;

      default:
        window.open(url, "_blank");
        break;
    }
  };

  useEffect(() => {
    if (Object.keys(colours).length > 0) {
      loadData();
    }
  }, [
    maxDaysLastCommit,
    minStars,
    minMentionableUsers,
    selectedAction,
    selectedXAxis,
    selectedYAxis,
    selectedSize,
    selectedBubbleColour,
    colours, // Add colours as a dependency
  ]);

  // Fetch colors data when the component mounts
  useEffect(() => {
    const fetchColors = async () => {
      const response = await fetch(LanguageColoursURL);
      const coloursData = await response.json();
      setColours(coloursData);
    };

    fetchColors();
  }, []); // Empty dependency array ensures it runs only once on mount

  const getSize = (data) => {
    switch (selectedSize.metric) {
      case "stars":
        return data.map((row) => Math.sqrt(row[selectedSize.metric]) * 7);
      case "same":
        return data.map((row) => 600);
      case "liveness":
        return data.map((row) => row[selectedSize.metric] * 10);
      case "new-commits-last-30d":
        return data.map((row) => Math.sqrt(row[selectedSize.metric]) * 7);
      case "unique-contributors":
        return data.map((row) => Math.sqrt(row[selectedSize.metric]) * 12);
      default:
        return data.map((row) => 600);
    }
  };

  const getSizeRef = (metric) => {
    switch (metric) {
      case "new-commits-last-30d":
        return 2.0;
      case "unique-contributors":
        return 1.7;
      default:
        return 20.03;
    }
  };

  const buildChartData = async (dataRows) => {
    let updatedData = [];

    let filteredLanguagesSet = new Set();

    dataRows.forEach((element) => {
      if (
        parseInt(element["days-last-commit"]) < parseInt(maxDaysLastCommit) &&
        parseInt(element["stars"]) > parseInt(minStars) &&
        parseInt(element["mentionable-users"]) > parseInt(minMentionableUsers)
      ) {
        updatedData.push(element);
        filteredLanguagesSet.add(element.language);
      }
    });

    let filteredData = [];

    if (selectedBubbleColour.metric === "language") {
      filteredLanguagesSet.delete("");

      Array.from(filteredLanguagesSet).forEach((language) => {
        console.log(language);

        let updatedCategoryData = updatedData.filter(
          (row) => row["language"] === language
        );

        const trace = {
          x: updatedCategoryData.map((row) => row[selectedXAxis.metric]),
          y: updatedCategoryData.map((row) => row[selectedYAxis.metric]),
          repo: updatedCategoryData.map((row) => `${row.repo}`),
          text: updatedCategoryData.map(
            (row) =>
              `${row.repo}<br>Total Stars: ${formatStars(
                row.stars
              )}<br>Last commit: ${row["days-last-commit"]
              } days ago<br>Age: ${calculateAge(
                row["days-since-creation"]
              )}<br>Language: ${row["language"]} <br>Commits last 30d: ${row["new-commits-last-30d"]
              } <br>Unique authors last 30d: ${row["unique-contributors"]}`
          ),
          mode: "markers",
          marker: {
            size: getSize(updatedCategoryData),
            sizemode: "diameter",
            sizeref: getSizeRef(selectedSize.metric),
            color: language in colours ? colours[language].color : undefined,
          },
          type: "scatter",
          name: language,
        };

        filteredData.push(trace);
      });
    }

    if (selectedBubbleColour.metric === "liveness") {
      const trace = {
        x: updatedData.map((row) => row[selectedXAxis.metric]),
        y: updatedData.map((row) => row[selectedYAxis.metric]),
        repo: updatedData.map((row) => `${row.repo}`),
        text: updatedData.map(
          (row) =>
            `${row.repo}<br>Total Stars: ${formatStars(
              row.stars
            )}<br>Last commit: ${row["days-last-commit"]
            } days ago<br>Age: ${calculateAge(
              row["days-since-creation"]
            )}<br>Language: ${row["language"]} <br>Commits last 30d: ${row["new-commits-last-30d"]
            } <br>Unique authors last 30d: ${row["unique-contributors"]}`
        ),
        mode: "markers",
        marker: {
          size: getSize(updatedData),
          sizemode: "diameter",
          sizeref: getSizeRef(selectedSize.metric),
          color: updatedData.map((row) => mapLivenessToColor(row["liveness"])),
        },
        type: "scatter",
        name: "liveness",
      };

      filteredData.push(trace);
    }

    setData(filteredData);
  };

  const loadData = async () => {
    if (dataRows.length == 0) {
      fetch(csvURL)
        .then((response) => response.text())
        .then((text) =>
          Papa.parse(text, { header: true, skipEmptyLines: true })
        )
        .then(function (result) {
          buildChartData(result.data);
        })
        .catch((e) => {
          console.error(`An error occurred: ${e}`);
        });
    } else {
      buildChartData(dataRows);
    }
  };

  useEffect(() => {
    loadData();
  }, [
    maxDaysLastCommit,
    minStars,
    minMentionableUsers,
    selectedAction,
    selectedXAxis,
    selectedYAxis,
    selectedSize,
    selectedBubbleColour,
  ]);

  const layout = {
    xaxis: {
      type: "log",
      title: selectedXAxis.label,
      gridcolor: "rgba(150, 150, 150, 0.6)",
    },
    yaxis: {
      type: "log",
      title: selectedYAxis.label,
      gridcolor: "rgba(150, 150, 150, 0.6)",
    },
    size: "stars",
    color: "main-category",
    hovermode: "closest",
    hover_name: "repo",
    showlegend: true,
    margin: {
      t: 30, // Adjusted top margin
      r: 20,
      b: 50, // Adjusted bottom margin
      l: 50,
    },
    paper_bgcolor: "rgb(0, 0, 0, 0.7)", // Transparent background
    plot_bgcolor: "rgba(38, 42, 51, 0.8)", // Dark background
    font: { color: "white" }, // White text
  };

  return (
    <div
      style={{
        marginLeft: "10px",
        marginTop: "10px",
        marginRight: "10px",
        height: "90%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: "20px",
          marginBottom: "10px",
        }}
      >
        <TextField
          style={{ marginRight: "10px", marginLeft: "10px", width: "150px" }}
          label="Days since last commit"
          variant="outlined"
          size="small"
          value={maxDaysLastCommit}
          onChange={(e) => handleInputChange(e, setMaxDaysLastCommit)}
          InputProps={{
            inputProps: {
              pattern: "[0-9]*",
              inputMode: "numeric",
            },
          }}
        />
        <TextField
          style={{ marginRight: "10px", width: "100px" }}
          label="Min stars"
          variant="outlined"
          size="small"
          value={minStars}
          onChange={(e) => handleInputChange(e, setMinStars)}
          InputProps={{
            inputProps: {
              pattern: "[0-9]*",
              inputMode: "numeric",
            },
          }}
        />
        <TextField
          style={{ width: "120px" }}
          label="Min men. users"
          variant="outlined"
          size="small"
          value={minMentionableUsers}
          onChange={(e) => handleInputChange(e, setMinMentionableUsers)}
          InputProps={{
            inputProps: {
              pattern: "[0-9]*",
              inputMode: "numeric",
            },
          }}
        />
        <Autocomplete
          disablePortal
          style={{ marginLeft: "10px" }}
          id="actions-combo-box"
          size="small"
          options={clickActions}
          sx={{ width: 200 }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select an action on click"
              variant="outlined"
              size="small"
            />
          )}
          value={
            clickActions.find((element) => element.action === selectedAction) ??
            ""
          }
          onChange={(e, v, reason) => {
            if (reason === "clear") {
              setSelectedAction(clickActions[0].action);
            } else {
              setSelectedAction(v?.action);
            }
          }}
        />
        <Autocomplete
          disablePortal
          style={{ marginLeft: "10px" }}
          id="actions-x-box"
          size="small"
          options={axisMetrics}
          sx={{ width: 210 }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select X axis metric"
              variant="outlined"
              size="small"
            />
          )}
          value={
            axisMetrics.find(
              (element) => element.metric === selectedXAxis.metric
            ) ?? ""
          }
          onChange={(e, v, reason) => {
            if (reason === "clear") {
              setSelectedXAxis(axisMetrics[0]);
            } else {
              setSelectedXAxis(v);
            }
          }}
        />
        <Autocomplete
          disablePortal
          style={{ marginLeft: "10px" }}
          id="actions-y-box"
          size="small"
          options={axisMetrics}
          sx={{ width: 210 }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select Y axis metric"
              variant="outlined"
              size="small"
            />
          )}
          value={
            axisMetrics.find(
              (element) => element.metric === selectedYAxis.metric
            ) ?? ""
          }
          onChange={(e, v, reason) => {
            if (reason === "clear") {
              setSelectedYAxis(axisMetrics[3]);
            } else {
              setSelectedYAxis(v);
            }
          }}
        />
        <Autocomplete
          disablePortal
          style={{ marginLeft: "10px" }}
          id="actions-y-box"
          size="small"
          options={sizeMetrics}
          sx={{ width: 150 }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select size metric"
              variant="outlined"
              size="small"
            />
          )}
          value={
            sizeMetrics.find(
              (element) => element.metric === selectedSize.metric
            ) ?? ""
          }
          onChange={(e, v, reason) => {
            if (reason === "clear") {
              setSelectedSize(sizeMetrics[0]);
            } else {
              setSelectedSize(v);
            }
          }}
        />
        <Autocomplete
          disablePortal
          style={{ marginLeft: "10px" }}
          id="colour-box"
          size="small"
          options={bubbleColour}
          sx={{ width: 140 }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select Bubble Colour"
              variant="outlined"
              size="small"
            />
          )}
          value={
            bubbleColour.find(
              (element) => element.metric === selectedBubbleColour.metric
            ) ?? ""
          }
          onChange={(e, v, reason) => {
            if (reason === "clear") {
              setSelectedBubbleColour(bubbleColour[0]);
            } else {
              setSelectedBubbleColour(v);
            }
          }}
        />
      </div>
      <Plot
        data={data}
        layout={layout}
        style={{ width: "100%", height: "90%" }}
        onClick={(event) => handleBubbleClick(event)}
      />
    </div>
  );
};

export default BubbleChart;
