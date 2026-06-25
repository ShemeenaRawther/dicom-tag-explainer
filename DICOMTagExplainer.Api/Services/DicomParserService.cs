using DICOMTagExplainer.Api.Models;
using FellowOakDicom;

namespace DICOMTagExplainer.Api.Services
{
    public class DicomParserService
    {
        public async Task<DicomAnalysisResponse> ParseAsync(
       Stream stream,
       string fileName)
        {
            var dicomFile = await DicomFile.OpenAsync(stream);

            var fileMetaRoot = new DicomTagNode
            {
                Name = "File Meta Information",
                Source = "FileMeta"
            };

            var datasetRoot = new DicomTagNode
            {
                Name = "Main Dataset",
                Source = "Dataset"
            };

            AddDatasetToTree(
                dicomFile.FileMetaInfo,
                fileMetaRoot,
                "FileMeta");

            AddDatasetToTree(
                dicomFile.Dataset,
                datasetRoot,
                "Dataset");

            var flattenedTags = new List<DicomTagNode>();

            Flatten(fileMetaRoot, flattenedTags);
            Flatten(datasetRoot, flattenedTags);

            var groups = flattenedTags
                .Where(x => !string.IsNullOrWhiteSpace(x.TagCode))
                .GroupBy(x => GetGroupNumber(x.TagCode))
                .OrderBy(x => x.Key)
                .Select(group => new DicomGroupResponse
                {
                    GroupCode = group.Key.ToString("X4"),
                    GroupName = GetGroupName(group.Key),
                    Tags = group
                        .OrderBy(x => x.TagCode)
                        .ToList()
                })
                .ToList();

            return new DicomAnalysisResponse
            {
                FileName = fileName,
                TransferSyntax = dicomFile.FileMetaInfo.TransferSyntax.UID.UID,
                FileMeta = fileMetaRoot,
                Dataset = datasetRoot,
                Groups = groups
            };
        }    

    private static void AddDatasetToTree(
        DicomDataset dataset,
        DicomTagNode parent,
        string source)
        {
            foreach (var item in dataset)
            {
                var tag = item.Tag;

                var node = new DicomTagNode
                {
                    TagCode = FormatTag(tag),
                    Keyword = tag.DictionaryEntry.Keyword ?? "Unknown",
                    Name = tag.DictionaryEntry.Name ?? "Unknown",
                    Vr = item.ValueRepresentation.Code,
                    Source = source,
                    IsPrivate = tag.IsPrivate,
                    IsSequence = item is DicomSequence
                };

                if (tag == DicomTag.PixelData)
                {
                    node.Value = "[Pixel Data hidden]";
                }
                else if (item is DicomSequence sequence)
                {
                    node.Value = "[Sequence: " + sequence.Items.Count + " item(s)]";

                    for (int i = 0; i < sequence.Items.Count; i++)
                    {
                        var itemNode = new DicomTagNode
                        {
                            Name = "Item " + (i + 1),
                            Source = source
                        };

                        AddDatasetToTree(
                            sequence.Items[i],
                            itemNode,
                            source);

                        node.Children.Add(itemNode);
                    }
                }
                else
                {
                    node.Value = GetDisplayValue(item);
                }

                parent.Children.Add(node);
            }
        }

        private static void Flatten(
        DicomTagNode node,
        List<DicomTagNode> output)
        {
            if (!string.IsNullOrWhiteSpace(node.TagCode))
            {
                output.Add(node);
            }

            foreach (var child in node.Children)
            {
                Flatten(child, output);
            }
        }

        private static string GetDisplayValue(DicomItem item)
        {
            if (item is not DicomElement element)
            {
                return "[Unsupported]";
            }

            try
            {
                // Works with your older fo-dicom API.
                var value = element.Get<string>();

                if (string.IsNullOrWhiteSpace(value))
                {
                    return "[Empty]";
                }

                value = value.Replace("\\", " \\ ");

                if (value.Length > 200)
                {
                    return value.Substring(0, 200) + "...";
                }

                return value;
            }
            catch
            {
                return "[Binary / non-text value]";
            }
        }

        private static string FormatTag(DicomTag tag)
        {
            return string.Format(
                "({0:X4},{1:X4})",
                tag.Group,
                tag.Element);
        }

        private static ushort GetGroupNumber(string tagCode)
        {
            // "(0010,0010)" => "0010"
            var groupText = tagCode.Substring(1, 4);

            return Convert.ToUInt16(groupText, 16);
        }

        private static string GetGroupName(ushort group)
        {
            switch (group)
            {
                case 0x0002: return "File Meta Information";
                case 0x0008: return "Identification / General Study";
                case 0x0010: return "Patient";
                case 0x0012: return "Clinical Trial / De-identification";
                case 0x0018: return "Acquisition";
                case 0x0020: return "Relationship / Geometry";
                case 0x0028: return "Image Presentation / Pixel Information";
                case 0x0032: return "Study";
                case 0x0038: return "Visit";
                case 0x0040: return "Procedure / Workflow";
                case 0x5200: return "Functional Groups";
                case 0x7FE0: return "Pixel Data";
                default:
                    return (group % 2 == 1)
                        ? "Private Group"
                        : "Other";
            }
        }
    }
}
