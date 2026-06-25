// DicomTagExplorer.tsx
import { useMemo, useState } from "react";
import "./dicom-tag-explorer.css";

export type DicomTag = {
  tagCode: string;
  keyword: string;
  name: string;
  vr: string;
  value: string;
  source: "FileMeta" | "Dataset";
  isSequence: boolean;
  isPrivate: boolean;
  children: DicomTag[];
};

type DicomGroup = {
  groupCode: string;
  groupName: string;
  tags: DicomTag[];
};

type Props = {
  fileName: string;
  groups: DicomGroup[];
};

export default function DicomTagExplorer({ fileName, groups }: Props) {
  const [selectedGroup, setSelectedGroup] = useState(groups[0]?.groupCode ?? "");
  const [selectedTag, setSelectedTag] = useState<DicomTag | null>(null);
  const [query, setQuery] = useState("");

  const activeGroup = groups.find((g) => g.groupCode === selectedGroup);

  const visibleTags = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return activeGroup?.tags ?? [];

    return (activeGroup?.tags ?? []).filter((tag) =>
      [tag.tagCode, tag.name, tag.keyword, tag.vr, tag.value]
        .join(" ")
        .toLowerCase()
        .includes(text)
    );
  }, [activeGroup, query]);

  return (
    <div className="dicom-explorer">
      <header className="explorer-header">
        <div>
          <h1>{fileName}</h1>
          <p>{groups.reduce((total, group) => total + group.tags.length, 0)} tags detected</p>
        </div>

        <input
          className="tag-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tag, name, value or VR..."
        />
      </header>

      <div className="explorer-body">
        <aside className="group-sidebar">
          <div className="sidebar-title">Sections</div>

          {groups.map((group) => (
            <button
              key={group.groupCode}
              className={`group-button ${selectedGroup === group.groupCode ? "active" : ""}`}
              onClick={() => {
                setSelectedGroup(group.groupCode);
                setSelectedTag(null);
              }}
            >
              {/* <span>{group.groupName}</span>
              <span>
                {group.tags.length}
              </span> */}
                <span>
                {group.groupName} ({group.tags.length})
                </span>
            </button>
          ))}
        </aside>

        <main className="tag-content">
          <div className="section-heading">
            <div>
              <h2>{activeGroup?.groupName}</h2>
              <p>Group ({activeGroup?.groupCode}, xxxx)</p>
            </div>
            <span>{visibleTags.length} tags</span>
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
                {visibleTags.map((tag) => (
                  <TagRow
                    key={`${tag.tagCode}-${tag.keyword}`}
                    tag={tag}
                    onSelect={setSelectedTag}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </main>

        <aside className="details-panel">
          {selectedTag ? (
            <TagDetails tag={selectedTag} />
          ) : (
            <div className="empty-details">
              <strong>Select a tag</strong>
              <span>Its explanation, usage, and raw value will appear here.</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function TagRow({
  tag,
  onSelect,
  level = 0,
}: {
  tag: DicomTag;
  onSelect: (tag: DicomTag) => void;
  level?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = tag.children?.length > 0;

  return (
    <>
      <tr className="tag-row" onClick={() => onSelect(tag)}>
        <td>
          <span className="tag-code" style={{ paddingLeft: level * 18 }}>
            {hasChildren && (
              <button
                className="expand-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((value) => !value);
                }}
                aria-label={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? "⌄" : "›"}
              </button>
            )}
            {tag.tagCode || "—"}
          </span>
        </td>

        <td>
          <div className="attribute-name">{tag.name}</div>
          {tag.keyword && <div className="keyword">{tag.keyword}</div>}
        </td>

        <td><span className="vr-badge">{tag.vr || "—"}</span></td>

        <td>
          <div className="value-cell" title={tag.value}>
            {formatValue(tag)}
          </div>
        </td>

        <td>
          <div className="badges">
            {tag.isSequence && <span className="badge sequence">Sequence</span>}
            {tag.isPrivate && <span className="badge private">Private</span>}
            {tag.keyword === "PixelData" && <span className="badge neutral">Pixel data</span>}
          </div>
        </td>
      </tr>

      {expanded &&
        tag.children.map((child, index) => (
          <TagRow
            key={`${child.tagCode}-${child.name}-${index}`}
            tag={child}
            onSelect={onSelect}
            level={level + 1}
          />
        ))}
    </>
  );
}

function TagDetails({ tag }: { tag: DicomTag }) {
  return (
    <div className="tag-details">
      <span className="details-tag">{tag.tagCode || "Sequence item"}</span>
      <h3>{tag.name}</h3>
      <p className="details-keyword">{tag.keyword || "Nested DICOM item"}</p>

      <div className="detail-block">
        <label>Value</label>
        <code>{tag.value || "[Empty]"}</code>
      </div>

      <div className="detail-grid">
        <div><label>VR</label><strong>{tag.vr || "—"}</strong></div>
        <div><label>Source</label><strong>{tag.source}</strong></div>
      </div>

      <div className="detail-block">
        <label>Purpose</label>
        <p>
          Add this from your DICOM explanation dictionary. Do not generate the
          technical meaning only from an LLM.
        </p>
      </div>

      <div className="detail-block">
        <label>Where used</label>
        <div className="usage-chips">
          <span>Viewer</span>
          <span>PACS</span>
          <span>Validation</span>
        </div>
      </div>
    </div>
  );
}

function formatValue(tag: DicomTag) {
  if (tag.isSequence) return tag.value || `[Sequence: ${tag.children.length} item(s)]`;
  if (tag.value === "[Pixel Data hidden]") return "Pixel data hidden";
  return tag.value || "[Empty]";
}