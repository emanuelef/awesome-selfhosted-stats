import { useState, useEffect } from "react";
// @ts-ignore
import Papa from "papaparse";
import "./App.css";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Linkweb from "@mui/material/Link";

import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";

import TimeSeriesChart from "./TimeSeriesChart";
import BubbleChart from "./BubbleChart";
import GitHubButton from "react-github-btn";

import { Sidebar, Menu, MenuItem } from "react-pro-sidebar";
import { Routes, Route, Link, useParams, useNavigate } from "react-router-dom";

import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import ViewListRoundedIcon from "@mui/icons-material/ViewListRounded";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import LibraryBooksRoundedIcon from "@mui/icons-material/LibraryBooksRounded";
import ViewQuiltRounded from "@mui/icons-material/ViewQuiltRounded";
import BubbleChartRoundedIcon from "@mui/icons-material/BubbleChartRounded";

import Header from "./Header";

import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

/*
archived
"false"
days-last-commit
"151"
days-last-star
"5"
days-since-creation
"3961"
dependencies
"5"
language
"Go"
mentionable-users
"8"
new-stars-last-7d
"1"
new-stars-last-14d
"5"
new-stars-last-24H
"0"
new-stars-last-30d
"7"
repo
"mewkiz/flac"
stars
"262"
stars-per-mille-30d
"26.718"*/

const GitHubURL = "https://github.com/";

const csvURL =
  "https://raw.githubusercontent.com/emanuelef/awesome-selfhosted-stats/main/analysis-latest.csv";

const lastUpdateURL =
  "https://raw.githubusercontent.com/emanuelef/awesome-selfhosted-stats/main/last-update.txt";

const fullStarsHistoryURL =
  "https://emanuelef.github.io/daily-stars-explorer/#/";

const TimelineMetrics = ["Stars", "Commits"];

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

const calculateAge = (days) => {
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const remainingDays = days % 30;

  return `${years !== 0 ? `${years}y ` : ""}${months !== 0 ? `${months}m ` : ""
    }${remainingDays}d`;
};

const extractVersionNumber = (value) => {
  const match = value.match(/\d+(\.\d+)+(\.\d+)?/);
  return match ? match[0] : null;
};

const compareSemanticVersions = (versionA, versionB) => {
  const semVerA = versionA.split(".");
  const semVerB = versionB.split(".");

  for (let i = 0; i < Math.min(semVerA.length, semVerB.length); i++) {
    if (semVerA[i] !== semVerB[i]) {
      return semVerA[i] - semVerB[i];
    }
  }

  return semVerA.length - semVerB.length;
};

const columns: GridColDef[] = [
  {
    field: "repo",
    headerName: "Repo",
    width: 200,
    renderCell: (params) => (
      <Linkweb href={GitHubURL + params.value} target="_blank">
        {params.value}
      </Linkweb>
    ),
  },
  {
    field: "stars",
    headerName: "Stars",
    width: 90,
    valueGetter: (val) => parseInt(val),
  },
  {
    field: "tag",
    headerName: "Tag",
    width: 110,
  },
  {
    field: "liveness",
    headerName: "Liveness",
    width: 120,
    valueGetter: (val) => parseFloat(val),
    renderCell: (params) => {
      const value = params.value;
      const color = getColorFromValue(value);

      return (
        <div
          style={{
            backgroundColor: color,
            width: "100%",
            height: "80%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxSizing: "border-box",
            border: "1px solid grey",
          }}
        >
          {`${value}%`}
        </div>
      );
    },
  },
  {
    field: "days-last-star",
    headerName: "Days last star",
    width: 100,
    valueGetter: (val) => parseInt(val),
  },
  {
    field: "days-last-commit",
    headerName: "Days last commit",
    width: 110,
    valueGetter: (val) => parseInt(val),
  },
  {
    field: "new-stars-last-30d",
    headerName: "Stars last 30d",
    width: 110,
    valueGetter: (val) => parseInt(val),
  },
  {
    field: "new-stars-last-7d",
    headerName: "Stars last 7d",
    width: 110,
    valueGetter: (val) => parseInt(val),
  },
  {
    field: "stars-per-mille-30d",
    headerName: "New Stars 30d ‰",
    width: 130,
    valueGetter: (val) => parseFloat(val),
  },
  {
    field: "new-commits-last-30d",
    headerName: "Commits 30d",
    width: 100,
    valueGetter: (val) => parseInt(val),
  },
  {
    field: "unique-contributors",
    headerName: "Commits Authors 30d",
    width: 100,
    valueGetter: (val) => parseInt(val),
  },
  {
    field: "mentionable-users",
    headerName: "Ment. users",
    width: 100,
    valueGetter: (val) => parseInt(val),
  },
  {
    field: "language",
    headerName: "Lang.",
    width: 110,
  },
  {
    field: "days-since-creation",
    headerName: "Age",
    width: 130,
    valueGetter: (val) => parseInt(val),
    renderCell: (params) => calculateAge(params.value),
  },
  {
    field: "archived",
    headerName: "Archived",
    width: 90,
    renderCell: (params) => (
      <span style={{ color: params.value === "true" ? "red" : "inherit" }}>
        {params.value}
      </span>
    ),
  },
  {
    headerName: "Stars Timeline 30d",
    width: 110,
    renderCell: (params) => (
      <Linkweb href={`./#/starstimeline/${params.row.repo}`}>link</Linkweb>
    ),
  },
];

function App() {
  const fetchStats = () => {
    fetch(csvURL)
      .then((response) => response.text())
      .then((text) => Papa.parse(text, { header: true, skipEmptyLines: true }))
      .then(function (result) {
        setDataRows(result.data);
        setFilteredDataRows(result.data);
      })
      .catch((e) => {
        console.error(`An error occurred: ${e}`);
      });
  };

  const fetchLastUpdate = () => {
    fetch(lastUpdateURL)
      .then((response) => response.text())
      .then(function (dateString) {
        console.log(dateString);
        const parts = dateString.split("-");
        if (parts.length === 3) {
          const year = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1; // Months are 0-indexed
          const day = parseInt(parts[2]);
          const options = { year: "numeric", month: "long", day: "numeric" };
          const formattedDate = new Date(year, month, day).toLocaleDateString(
            "en-US",
            options
          );
          setLastUpdate(formattedDate);
        }
      })
      .catch((e) => {
        console.error(`An error occurred: ${e}`);
      });
  };

  const [dataRows, setDataRows] = useState([]);
  const [filteredDataRows, setFilteredDataRows] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState("activepieces/activepieces");
  const [collapsed, setCollapsed] = useState(true);
  const [lastUpdate, setLastUpdate] = useState("Unknown");
  const [mainCategory, setMainCategory] = useState("All");
  const [subCategory, setSubCategory] = useState("All");
  const [subCategories, setSubCategories] = useState([]);
  const [selectedTimelineMetric, setSelectedTimelineMetric] = useState(
    TimelineMetrics[0]
  );

  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
    fetchLastUpdate();
  }, []);

  useEffect(() => {
    const subCategories = [
      ...new Set(
        dataRows
          .filter((el) => el["category"] === mainCategory)
          .map((el) => el["subcategory"])
      ),
    ];
    setSubCategories(subCategories);

    if (mainCategory === "All") {
      setFilteredDataRows(dataRows);
    } else {
      setFilteredDataRows(
        dataRows.filter((el) => el["category"] === mainCategory)
      );
    }
  }, [mainCategory]);

  useEffect(() => {
    if (subCategory === "All") {
      setFilteredDataRows(
        dataRows.filter((el) => el["category"] === mainCategory)
      );
    } else {
      setFilteredDataRows(
        dataRows.filter((el) => el["subcategory"] === subCategory)
      );
    }
  }, [subCategory]);

  const Table = () => {
    return (
      <>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: "10px",
            marginBottom: "10px",
          }}
        >
        </div>
        <div style={{ marginLeft: "10px", marginRight: "90px", height: "86%" }}>
          <DataGrid
            getRowId={(row) => row.repo}
            rows={filteredDataRows}
            columns={columns}
            rowHeight={30}
            initialState={{
              pagination: {
                paginationModel: { page: 0, pageSize: 25 },
              },
              sorting: {
                sortModel: [{ field: "stars-per-mille-30d", sort: "desc" }],
              },
            }}
            pageSizeOptions={[5, 10, 50]}
          />
        </div>
      </>
    );
  };

  const StarsTimeline = () => {
    const { user, repository } = useParams();

    useEffect(() => {
      console.log(user + "/" + repository);
      setSelectedRepo(user + "/" + repository);
    }, []);

    return (
      <>
        <div
          style={{ display: "flex", alignItems: "center", marginTop: "10px" }}
        >
          <Autocomplete
            disablePortal
            id="combo-box-demo"
            size="small"
            options={dataRows.map((el) => {
              return { label: el.repo };
            })}
            renderInput={(params) => (
              <TextField
                {...params}
                style={{
                  marginRight: "20px",
                  marginLeft: "10px",
                  width: "400px",
                }}
                label="Enter a GitHub repository"
                variant="outlined"
                size="small"
              />
            )}
            value={selectedRepo}
            onChange={(e, v, reason) => {
              if (reason === "clear") {
                setSelectedRepo("activepieces/activepieces");
                navigate(`/starstimeline/activepieces/activepieces`, {
                  replace: false,
                });
              } else {
                setSelectedRepo(v?.label);
                navigate(`/starstimeline/${v?.label}`, {
                  replace: false,
                });
              }
            }}
          />
          <Autocomplete
            disablePortal
            style={{ marginLeft: "10px", marginRight: "20px" }}
            id="actions-combo-box"
            size="small"
            options={TimelineMetrics}
            sx={{ width: 220 }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select a metric"
                variant="outlined"
                size="small"
              />
            )}
            value={selectedTimelineMetric}
            onChange={(e, v, reason) => {
              if (reason === "clear") {
                setSelectedTimelineMetric(TimelineMetrics[0]);
              } else {
                setSelectedTimelineMetric(v);
              }
            }}
          />
          <GitHubButton
            href={"https://github.com/" + selectedRepo}
            data-color-scheme="no-preference: dark; light: dark_dimmed; dark: dark_high_contrast;"
            data-size="large"
            data-show-count="true"
            aria-label="Star buttons/github-buttons on GitHub"
          >
            Star
          </GitHubButton>
          <Linkweb
            style={{ marginLeft: "10px" }}
            href={fullStarsHistoryURL + selectedRepo}
            target="_blank"
          >
            Full Stars History
          </Linkweb>
        </div>
        <TimeSeriesChart repo={selectedRepo} metric={selectedTimelineMetric} />
      </>
    );
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <div style={{ display: "flex", height: "100vh" }}>
        <Sidebar
          className="app"
          collapsed={collapsed}
          backgroundColor="rgb(51, 117, 117)"
        >
          <Menu
            menuItemStyles={{
              button: ({ level, active, disabled }) => {
                if (level >= 0)
                  return {
                    color: disabled ? "#f5d9ff" : "#07100d",
                    backgroundColor: active ? "#00cef9" : "undefined",
                  };
              },
            }}
          >
            <MenuItem
              component={<Link to="/" className="link" />}
              className="menu1"
              icon={
                <MenuRoundedIcon
                  onClick={() => {
                    setCollapsed(!collapsed);
                  }}
                />
              }
            >
              <h2 style={{ color: "black" }}>Awesome Selfhosted Stats</h2>
            </MenuItem>
            <MenuItem
              component={<Link to="/table" className="link" />}
              icon={<ViewListRoundedIcon />}
            >
              Table
            </MenuItem>
            <MenuItem
              component={<Link to="/bubble" className="link" />}
              icon={<BubbleChartRoundedIcon />}
            >
              Bubble
            </MenuItem>
            <MenuItem
              component={
                <Link
                  to="/starstimeline/activepieces/activepieces"
                  className="link"
                />
              }
              icon={<TimelineRoundedIcon />}
            >
              StarsTimeline
            </MenuItem>
          </Menu>
        </Sidebar>
        <section style={{ width: "100%" }}>
          <Header lastUpdate={lastUpdate} />
          <Routes>
            <Route path="/" element={<Table />} />
            <Route path="/table" element={<Table />} />
            <Route
              path="/starstimeline/:user/:repository"
              element={<StarsTimeline />}
            />
            <Route
              path="/bubble"
              element={<BubbleChart dataRows={dataRows} />}
            />
          </Routes>
        </section>
      </div>
    </ThemeProvider>
  );
}

export default App;
