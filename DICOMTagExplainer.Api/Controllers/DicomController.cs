using DICOMTagExplainer.Api.Models;
using DICOMTagExplainer.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DICOMTagExplainer.Api.Controllers
{
    [Route("api/dicom")]
    [ApiController]
    public class DicomController : ControllerBase
    {
        private readonly DicomParserService _parser;

        public DicomController(DicomParserService parser)
        {
            _parser = parser;
        }

        [HttpPost("analyze")]
        [RequestSizeLimit(100_000_000)] // 100 MB
        public async Task<ActionResult<DicomAnalysisResponse>> Analyze(
        IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest("Please upload a DICOM file.");
            }

            try
            {
                await using var stream = file.OpenReadStream();

                var result = await _parser.ParseAsync(
                    stream,
                    file.FileName);

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(
                    "Could not parse this file as DICOM. " + ex.Message);
            }
        }
    }

}
