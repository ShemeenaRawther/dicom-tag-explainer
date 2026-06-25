namespace DICOMTagExplainer.Api.Models
{
    public class DicomTagNode
    {
        public string TagCode { get; set; } = "";
        public string Keyword { get; set; } = "";
        public string Name { get; set; } = "";
        public string Vr { get; set; } = "";
        public string Value { get; set; } = "";
        public string Source { get; set; } = ""; // FileMeta or Dataset
        public bool IsSequence { get; set; }
        public bool IsPrivate { get; set; }
        public List<DicomTagNode> Children { get; set; } = new();
    }
}
