// History.jsx
import React, { useEffect, useState, useMemo } from "react";
import "./History.css";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper to format date
const formatDate = (dateStr) => {
  if (!dateStr) return "--";
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

function History() {
  const [repairs, setRepairs] = useState([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  // Fetch verified history from backend API
  const fetchHistory = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/reports/history/verified`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.status}`);
      }

      const data = await response.json();
      return data.history || [];
    } catch (err) {
      console.error('API history fetch failed:', err);
      setApiError(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Map API data to frontend format
  const mapApiToFrontend = (item) => ({
    id: `LOC-${item.id}`,
    location: `${item.latitude}, ${item.longitude}`,
    roadName: item.road_name || null,
    severity: item.highest_severity || "Medium",
    contractor: item.contractor_name || "Unknown",
    fixedDate: formatDate(item.verified_at || item.completed_at),
    status: "Verified",
    reportCount: item.report_count || 1
  });

  useEffect(() => {
    const loadData = async () => {
      const apiData = await fetchHistory();
      const mapped = apiData.map(mapApiToFrontend);
      setRepairs(mapped);
    };

    loadData();
  }, []);

  // helper: parse "lat, lon" string
  const parseLatLon = (locationStr) => {
    if (!locationStr) return null;
    const [latStr, lonStr] = locationStr.split(",").map((s) => s.trim());
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  };

  // reverse geocode to road name (OpenStreetMap Nominatim)
  const fetchRoadName = async (lat, lon) => {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=16`;
    const res = await fetch(url, {
      headers: { "User-Agent": "PotholeDashboard/1.0 (contact@example.com)" }
    });
    if (!res.ok) throw new Error("Reverse geocoding failed");
    const data = await res.json();
    return (
      data?.address?.road ||
      data?.address?.pedestrian ||
      data?.address?.footway ||
      data?.address?.neighbourhood ||
      data?.display_name ||
      "Unknown road"
    );
  };

  // Resolve missing road names from location (only for entries without roadName)
  useEffect(() => {
    const resolveRoads = async () => {
      const need = repairs.some((r) => !r.roadName && r.location);
      if (!need) return;
      try {
        const updated = [];
        for (const r of repairs) {
          if (r.roadName || !r.location) {
            updated.push(r);
            continue;
          }
          const coords = parseLatLon(r.location);
          if (!coords) {
            updated.push({ ...r, roadName: "Unknown road" });
            continue;
          }
          try {
            const name = await fetchRoadName(coords.lat, coords.lon);
            // small delay to be polite to the API
            await new Promise((res) => setTimeout(res, 300));
            updated.push({ ...r, roadName: name });
          } catch {
            updated.push({ ...r, roadName: "Unknown road" });
          }
        }
        setRepairs(updated);
      } catch (err) {
        console.error("Road name resolution failed:", err);
      }
    };
    if (repairs.length && !isLoading) resolveRoads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repairs.length, isLoading]);

  // Build cumulative (grouped-by-road) view
  const groupedRepairs = useMemo(() => {
    const groups = {};
    for (const r of repairs) {
      const road = (r.roadName || "Unknown road").trim();
      if (!groups[road]) {
        groups[road] = {
          roadName: road,
          totalReports: 0,
          lastFixedDate: null,
          contractors: new Set(),
          ids: [],
          locations: [],
          severities: [],
        };
      }
      // Count reports (using reportCount from API)
      groups[road].totalReports += r.reportCount || 1;
      // Track latest fixed date
      const d = r.fixedDate && r.fixedDate !== "--" ? new Date(r.fixedDate) : null;
      if (d && !isNaN(d.getTime()) && (!groups[road].lastFixedDate || d > groups[road].lastFixedDate)) {
        groups[road].lastFixedDate = d;
      }
      if (r.contractor && r.contractor !== "Unknown") groups[road].contractors.add(r.contractor);
      if (r.id) groups[road].ids.push(r.id);
      if (r.location) groups[road].locations.push(r.location);
      if (r.severity) groups[road].severities.push(r.severity);
    }
    const severityRank = (s) => (s === "High" ? 3 : s === "Medium" ? 2 : s === "Low" ? 1 : 0);
    // Convert to array
    const rows = Object.values(groups).map((g) => ({
      roadName: g.roadName,
      totalReports: g.totalReports,
      lastFixedDate: g.lastFixedDate
        ? g.lastFixedDate.toLocaleString(undefined, {
            month: "short",
            day: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "--",
      contractors: Array.from(g.contractors),
      ids: g.ids,
      locations: g.locations,
      severity: g.severities.reduce((best, s) => (severityRank(s) > severityRank(best) ? s : best), "N/A"),
      status: "Verified",
    }));
    return rows.sort((a, b) => a.roadName.localeCompare(b.roadName));
  }, [repairs]);

  const filteredGrouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groupedRepairs.filter((g) => {
      const contractors = g.contractors.join(", ").toLowerCase();
      return (
        !q ||
        g.roadName.toLowerCase().includes(q) ||
        contractors.includes(q)
      );
    });
  }, [groupedRepairs, query]);

  const severityClass = (sev) => {
    if (sev === "High") return "pill-danger";
    if (sev === "Medium") return "pill-warning";
    if (sev === "Low") return "pill-success";
    return "";
  };

  return (
    <section className="history-container">
      <div className="history-card">
        <div className="page-heading">
          <div>
            <h1>Verified Repairs</h1>
            <p className="muted">
              Only admin-verified repairs are archived here.
            </p>
          </div>
          <span className="pill success">Verified & Closed</span>
        </div>

        {apiError && (
          <div className="api-error" style={{ color: "#dc2626", padding: "12px", background: "#fef2f2", borderRadius: "8px", marginBottom: "16px" }}>
            Failed to load data: {apiError}
          </div>
        )}

        <div className="history-search">
          <input
            type="text"
            placeholder="Search by road name or contractor..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="history-table-wrapper">
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "48px", color: "#6b7280" }}>
              Loading verified repairs...
            </div>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Road Name</th>
                  <th>Total Reports</th>
                  <th>Location IDs</th>
                  <th>Coordinates</th>
                  <th>Severity</th>
                  <th>Last Verified</th>
                  <th>Contractors</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredGrouped.map((row) => (
                  <tr key={row.roadName}>
                    <td className="road-name">{row.roadName}</td>
                    <td>{row.totalReports}</td>
                    <td>{row.ids.slice(0, 3).join(", ")}{row.ids.length > 3 ? ` (+${row.ids.length - 3})` : ""}</td>
                    <td>{row.locations.slice(0, 2).join(" | ")}{row.locations.length > 2 ? ` (+${row.locations.length - 2})` : ""}</td>
                    <td>
                      <span className={severityClass(row.severity)}>{row.severity}</span>
                    </td>
                    <td>{row.lastFixedDate}</td>
                    <td>{row.contractors.length ? row.contractors.join(", ") : "--"}</td>
                    <td>
                      <span className="status-verified">{row.status}</span>
                    </td>
                  </tr>
                ))}
                {filteredGrouped.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center", padding: "24px", color: "#6b7280" }}>
                      No verified repairs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="history-footer">
          <CheckCircleIcon sx={{ fontSize: 18, color: "#16a34a" }} />
          <span>{filteredGrouped.length} verified roads</span>
        </div>
      </div>
    </section>
  );
}

export default History;
