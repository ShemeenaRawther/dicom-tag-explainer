// App.tsx
import { useCallback, useMemo, useRef, useState } from "react";
import "./App.css";

type DicomTag = {
  tagCode: string;
  keyword: string;
  name: string;
  vr: string;
  value: string;
  source?: "FileMeta" | "Dataset";
  isSequence?: boolean;
  isPrivate?: boolean;
  children?: DicomTag[];
};

type DicomGroup = {
  groupCode: string;
  groupName: string;
  tags: DicomTag[];
};

type AnalyzeResponse = {
  fileName?: string;
  fileMeta?: DicomTag[];
  dataset?: DicomTag[];
  groups?: DicomGroup[];
};

const API_URL = "https://dicom-tag-explainer.onrender.com/api/dicom/analyze";

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [groups, setGroups] = useState<DicomGroup[]>([]);
  const [selectedGroupCode, setSelectedGroupCode] = useState("");
  const [selectedTag, setSelectedTag] = useState<DicomTag | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.groupCode === selectedGroupCode),
    [groups, selectedGroupCode]
  );

  const visibleTags = useMemo(() => {
    const tags = selectedGroup?.tags ?? [];
    const search = query.trim().toLowerCase();
    if (!search) return tags;
    return tags.filter((tag) =>
      [tag.tagCode, tag.name, tag.keyword, tag.vr, tag.value,
        tag.isPrivate ? "private" : "", tag.isSequence ? "sequence" : ""]
        .join(" ").toLowerCase().includes(search)
    );
  }, [selectedGroup, query]);

  const totalTags = useMemo(
    () => groups.reduce((total, group) => total + countTags(group.tags), 0),
    [groups]
  );

  async function analyzeDicom() {
    if (!file) { setError("Please choose a DICOM file first."); return; }
    try {
      setLoading(true);
      setError("");
      setSelectedTag(null);
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(API_URL, { method: "POST", body: formData });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to analyze the DICOM file.");
      }
      const data: AnalyzeResponse = await response.json();
      const normalizedGroups = normalizeGroups(data);
      setFileName(data.fileName || file.name);
      setGroups(normalizedGroups);
      setSelectedGroupCode(normalizedGroups[0]?.groupCode ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setGroups([]);
      setSelectedGroupCode("");
    } finally {
      setLoading(false);
    }
  }

  const applyFile = useCallback((f: File) => {
    setFile(f);
    setFileName(f.name);
    setGroups([]);
    setSelectedGroupCode("");
    setSelectedTag(null);
    setQuery("");
    setError("");
  }, []);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const f = event.target.files?.[0] ?? null;
    if (f) applyFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) applyFile(f);
  }

  function resetUpload() {
    setFile(null);
    setFileName("");
    setGroups([]);
    setSelectedGroupCode("");
    setSelectedTag(null);
    setQuery("");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const fileSizeLabel = file
    ? file.size > 1024 * 1024
      ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
      : `${(file.size / 1024).toFixed(0)} KB`
    : "";

  return (
    <div className="app-shell">
      {/* ── Top bar ── */}
      <header className="topbar">
        <div className="brand">
          <h1>DICOM Tag Explainer</h1>
          <p>Inspect, understand, and validate DICOM metadata</p>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {/* ── Upload zone (shown when no file loaded yet) ── */}
      {!file && (
        <div
          className={`upload-zone${isDragging ? " drag" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".dcm,.dicom,application/dicom"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <div className="upload-icon">↑</div>
          <h2 className="upload-title">Drop your DICOM file here</h2>
          <p className="upload-desc">Drag and drop or click to browse from your device</p>
          <span className="btn-browse">📂 Browse file</span>
          <div className="format-tags">
            {[".dcm", ".dicom", "DICOM Part 10"].map((fmt) => (
              <span key={fmt} className="fmt-tag">{fmt}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── File loaded card (shown after file pick, before or after analyze) ── */}
      {file && !groups.length && (
        <div className="file-card">
          <div className="file-card-icon">🩻</div>
          <div className="file-card-info">
            <div className="file-card-name">{file.name}</div>
            <div className="file-card-meta">{fileSizeLabel} · ready to analyze</div>
          </div>
          <button className="btn-replace" onClick={resetUpload}>↺ Replace</button>
          <button
            className="analyze-button"
            onClick={analyzeDicom}
            disabled={loading}
          >
            {loading ? "Analyzing…" : "🔍 Analyze file"}
          </button>
        </div>
      )}

      {/* ── Empty state hint ── */}
      {!file && (
        <div className="empty-state">
          <div className="empty-icon">⌁</div>
          <h2>Upload a DICOM file to inspect its tags</h2>
          <p>
            Tags will be grouped into readable sections. Click a tag to see
            its value, purpose, privacy risk, and workflow usage.
          </p>
        </div>
      )}

      {/* ── Explorer (shown after successful analyze) ── */}
      {groups.length > 0 && (
        <main className="dicom-explorer">
          {/* Summary bar */}
          <section className="explorer-summary">
            <div className="summary-left">
              <span className="summary-filename">{fileName}</span>
              <div className="summary-stats">
                <div className="stat-chip">
                  <span className="stat-num">{totalTags}</span>
                  <span className="stat-lbl">Tags</span>
                </div>
                <div className="stat-chip">
                  <span className="stat-num">{groups.length}</span>
                  <span className="stat-lbl">Sections</span>
                </div>
              </div>
            </div>
            <div className="summary-right">
              <div className="search-wrap">
                <span className="search-icon">🔎</span>
                <input
                  className="tag-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tag, attribute, value, VR…"
                />
              </div>
              <button className="btn-replace-inline" onClick={resetUpload}>↺ New file</button>
            </div>
          </section>

          <div className="explorer-layout">
            {/* Sidebar */}
            <aside className="group-sidebar">
              <div className="sidebar-title">Sections</div>
              {groups.map((group) => (
                <button
                  key={group.groupCode}
                  className={`group-button${selectedGroupCode === group.groupCode ? " active" : ""}`}
                  onClick={() => { setSelectedGroupCode(group.groupCode); setSelectedTag(null); }}
                >
                  <span>{group.groupName}</span>
                  <span className="count">{countTags(group.tags)}</span>
                </button>
              ))}
            </aside>

            {/* Tag table */}
            <section className="tag-content">
              <div className="section-heading">
                <div>
                  <h2>{selectedGroup?.groupName ?? "Tags"}</h2>
                  <p>Group ({selectedGroup?.groupCode ?? "----"}, xxxx)</p>
                </div>
                <span className="result-count">{visibleTags.length} visible</span>
              </div>

              <div className="table-wrap">
                <table className="tag-table">
                  <thead>
                    <tr>
                      <th>Tag</th>
                      <th>Attribute</th>
                      <th>VR</th>
                      <th>Value</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTags.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="no-results">No matching tags found.</td>
                      </tr>
                    ) : (
                      visibleTags.map((tag, index) => (
                        <TagRow
                          key={`${tag.tagCode}-${tag.keyword}-${index}`}
                          tag={tag}
                          selectedTag={selectedTag}
                          onSelect={setSelectedTag}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Details panel */}
            <aside className="details-panel">
              {selectedTag ? (
                <TagDetails tag={selectedTag} />
              ) : (
                <div className="empty-details">
                  <div className="details-placeholder-icon">ⓘ</div>
                  <strong>Select a tag</strong>
                  <span>Click any row to view its value and explanation.</span>
                </div>
              )}
            </aside>
          </div>
        </main>
      )}
    </div>
  );
}

// ─── TagRow ────────────────────────────────────────────────────────────────

function TagRow({
  tag, selectedTag, onSelect, level = 0,
}: {
  tag: DicomTag;
  selectedTag: DicomTag | null;
  onSelect: (tag: DicomTag) => void;
  level?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const children = tag.children ?? [];
  const hasChildren = children.length > 0;
  const isSelected =
    selectedTag?.tagCode === tag.tagCode &&
    selectedTag?.keyword === tag.keyword &&
    selectedTag?.value === tag.value;

  return (
    <>
      <tr className={`tag-row${isSelected ? " selected" : ""}`} onClick={() => onSelect(tag)}>
        <td>
          <div className="tag-code" style={{ paddingLeft: `${level * 18}px` }}>
            {hasChildren ? (
              <button
                className="expand-button"
                type="button"
                aria-label={expanded ? "Collapse sequence" : "Expand sequence"}
                onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
              >
                {expanded ? "⌄" : "›"}
              </button>
            ) : (
              <span className="expand-placeholder" />
            )}
            {tag.tagCode || "Item"}
          </div>
        </td>
        <td>
          <div className="attribute-name">{tag.name || "Unnamed Tag"}</div>
          {tag.keyword && <div className="keyword">{tag.keyword}</div>}
        </td>
        <td><span className="vr-badge">{tag.vr || "—"}</span></td>
        <td>
          <div className="value-cell" title={getDisplayValue(tag)}>{getDisplayValue(tag)}</div>
        </td>
        <td>
          <div className="badges">
            {tag.isSequence && <span className="badge sequence">Sequence</span>}
            {tag.isPrivate && <span className="badge private">Private</span>}
            {isPhiTag(tag) && <span className="badge phi">PHI</span>}
            {tag.keyword === "PixelData" && <span className="badge neutral">Pixel data</span>}
          </div>
        </td>
      </tr>
      {expanded &&
        children.map((child, index) => (
          <TagRow
            key={`${child.tagCode}-${child.keyword}-${index}`}
            tag={child}
            selectedTag={selectedTag}
            onSelect={onSelect}
            level={level + 1}
          />
        ))}
    </>
  );
}

// ─── TagDetails ────────────────────────────────────────────────────────────

function TagDetails({ tag }: { tag: DicomTag }) {
  const purpose = getTagPurpose(tag);
  const usedBy = getTagUsage(tag);
  const privacy = getPrivacyRisk(tag);

  return (
    <div className="tag-details">
      <span className="details-tag">{tag.tagCode || "Sequence item"}</span>
      <h3>{tag.name || "Unnamed Tag"}</h3>
      {tag.keyword && <p className="details-keyword">{tag.keyword}</p>}

      <div className="detail-block">
        <label>Value</label>
        <code>{getDisplayValue(tag)}</code>
      </div>

      <div className="detail-grid">
        <div><label>VR</label><strong>{tag.vr || "—"}</strong></div>
        <div><label>Source</label><strong>{tag.source || "Dataset"}</strong></div>
      </div>

      <div className="detail-block">
        <label>What it means</label>
        <p>{purpose}</p>
      </div>

      <div className="detail-block">
        <label>Where it is used</label>
        <div className="usage-chips">
          {usedBy.map((usage) => <span key={usage}>{usage}</span>)}
        </div>
      </div>

      <div className="detail-block">
        <label>Privacy risk</label>
        <p>{privacy}</p>
      </div>

      {tag.isPrivate && (
        <div className="private-warning">
          This is a vendor/private tag. Its exact meaning may require the
          manufacturer's private DICOM dictionary.
        </div>
      )}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function normalizeGroups(data: AnalyzeResponse): DicomGroup[] {
  if (data.groups?.length) {
    return data.groups.map((group) => ({ ...group, tags: group.tags ?? [] }));
  }
  const fileMeta = data.fileMeta ?? [];
  const dataset = data.dataset ?? [];
  return [
    ...(fileMeta.length
      ? [{ groupCode: "0002", groupName: "File Meta Information",
          tags: fileMeta.map((tag) => ({ ...tag, source: "FileMeta" as const })) }]
      : []),
    ...createGroupsFromTags(dataset.map((tag) => ({ ...tag, source: "Dataset" as const }))),
  ];
}

function createGroupsFromTags(tags: DicomTag[]): DicomGroup[] {
  const map = new Map<string, DicomTag[]>();
  for (const tag of tags) {
    const groupCode = getGroupCode(tag.tagCode);
    if (!map.has(groupCode)) map.set(groupCode, []);
    map.get(groupCode)?.push(tag);
  }
  return Array.from(map.entries()).map(([groupCode, groupTags]) => ({
    groupCode,
    groupName: getGroupName(groupCode, groupTags),
    tags: groupTags,
  }));
}

function getGroupCode(tagCode: string) {
  const match = tagCode.match(/[0-9A-Fa-f]{4}/);
  return match?.[0]?.toUpperCase() ?? "OTHER";
}

function getGroupName(groupCode: string, tags: DicomTag[]) {
  const firstKeyword = tags[0]?.keyword ?? "";
  if (groupCode === "0008") return "Identification & Study";
  if (groupCode === "0010") return "Patient";
  if (groupCode === "0018") return "Acquisition";
  if (groupCode === "0020") return "Relationship & Geometry";
  if (groupCode === "0028") return "Image Pixel";
  if (groupCode === "0040") return "Procedure & Workflow";
  if (groupCode === "7FE0") return "Pixel Data";
  if (groupCode === "0002") return "File Meta Information";
  if (firstKeyword.includes("Patient")) return "Patient";
  if (firstKeyword.includes("Study")) return "Study";
  return `DICOM Group ${groupCode}`;
}

function countTags(tags: DicomTag[]): number {
  return tags.reduce((total, tag) => total + 1 + countTags(tag.children ?? []), 0);
}

function getDisplayValue(tag: DicomTag) {
  if (tag.isSequence) return tag.value || `[Sequence: ${(tag.children ?? []).length} item(s)]`;
  if (tag.keyword === "PixelData") return "Pixel data hidden";
  return tag.value || "[Empty]";
}

function isPhiTag(tag: DicomTag) {
  const phiKeywords = [
    "PatientName", "PatientID", "PatientBirthDate", "PatientAddress",
    "PatientTelephoneNumbers", "AccessionNumber", "InstitutionName",
    "ReferringPhysicianName", "OperatorsName",
  ];
  return phiKeywords.includes(tag.keyword);
}

function getPrivacyRisk(tag: DicomTag) {
  if (isPhiTag(tag)) return "High: this tag may contain directly identifying patient or provider information.";
  if (tag.isPrivate) return "Review required: private tags can contain device, site, or patient-related information.";
  if (tag.keyword === "PixelData") return "Review image pixels for burned-in text before sharing the file.";
  return "Low: this is usually technical metadata, but validate it as part of your de-identification policy.";
}

function getTagPurpose(tag: DicomTag) {
  const explanations: Record<string, string> = {
    TransferSyntaxUID: "Defines how the DICOM file is encoded so another system can read the byte order, value representation, and compression correctly.",
    MediaStorageSOPClassUID: "Identifies the type of DICOM object stored in this file, such as CT Image Storage or MR Image Storage.",
    SOPClassUID: "Identifies the DICOM object type and helps viewers and PACS systems determine which attributes and behaviours apply.",
    SOPInstanceUID: "Uniquely identifies this specific DICOM object across systems.",
    PatientName: "Stores the patient name associated with the imaging study.",
    PatientID: "Stores the identifier used to match this imaging study to a patient record.",
    Modality: "Indicates the imaging modality, such as CT, MR, CR, DX, US, or NM.",
    StudyInstanceUID: "Uniquely identifies the study that contains one or more imaging series.",
    SeriesInstanceUID: "Uniquely identifies a series within a study.",
    Rows: "Defines the number of image rows, which is the image height in pixels.",
    Columns: "Defines the number of image columns, which is the image width in pixels.",
    PixelSpacing: "Defines the real-world distance between adjacent pixels. It is important for accurate measurements and 3D reconstruction.",
    ImagePositionPatient: "Defines the 3D location of the image in patient coordinates so slices can be positioned correctly.",
    ImageOrientationPatient: "Defines the orientation of image rows and columns in patient coordinates.",
    PixelData: "Contains the actual image pixel values. It is hidden in this inspector because it can be very large.",
  };
  if (tag.isSequence) return "A sequence contains nested DICOM items. Expand it to inspect the attributes inside each item.";
  if (tag.isPrivate) return "This is a private vendor-specific attribute. The standard DICOM dictionary may not define its exact meaning.";
  return explanations[tag.keyword] ?? "This DICOM attribute stores metadata used by imaging systems, workflows, viewers, or data validation.";
}

function getTagUsage(tag: DicomTag) {
  if (tag.isSequence) return ["Structured metadata", "Workflow", "DICOM validation"];
  if (isPhiTag(tag)) return ["Patient matching", "PACS", "RIS/EMR", "De-identification"];
  const usage: Record<string, string[]> = {
    TransferSyntaxUID: ["DICOM reader", "PACS", "File decoding"],
    MediaStorageSOPClassUID: ["PACS", "DICOM routing", "Viewer"],
    SOPClassUID: ["PACS", "DICOM validation", "Viewer"],
    SOPInstanceUID: ["PACS", "DICOM retrieval", "Audit"],
    Modality: ["Viewer", "Routing", "Worklist"],
    PixelSpacing: ["Measurements", "3D reconstruction", "AI preprocessing"],
    ImagePositionPatient: ["MPR viewer", "3D reconstruction", "AI preprocessing"],
    ImageOrientationPatient: ["MPR viewer", "3D reconstruction", "AI preprocessing"],
    Rows: ["Image rendering", "AI preprocessing"],
    Columns: ["Image rendering", "AI preprocessing"],
    PixelData: ["Viewer", "PACS", "AI inference"],
  };
  return usage[tag.keyword] ?? ["DICOM viewer", "PACS", "Validation"];
}
