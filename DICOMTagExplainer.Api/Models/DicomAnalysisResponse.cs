using DICOMTagExplainer.Api.Models;

namespace DICOMTagExplainer.Api.Models
{
    public class DicomAnalysisResponse
    {
        public string FileName { get; set; } = "";
        public string TransferSyntax { get; set; } = "";
        public DicomTagNode FileMeta { get; set; } = new();
        public DicomTagNode Dataset { get; set; } = new();
        public List<DicomGroupResponse> Groups { get; set; } = new();
    }
}


public class DicomGroupResponse
{
    public string GroupCode { get; set; } = "";
    public string GroupName { get; set; } = "";
    public List<DicomTagNode> Tags { get; set; } = new();
}