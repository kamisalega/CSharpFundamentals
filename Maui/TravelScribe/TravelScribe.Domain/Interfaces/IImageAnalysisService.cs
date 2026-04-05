using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TravelScribe.Domain.Models;

namespace TravelScribe.Domain.Interfaces;
public interface IImageAnalysisService
{
    Task<PropertyPhoto> AnalyzeImageAsync(byte[] imageData, string fileName);
    Task<List<string>> ExtractTagsAsync(byte[] imageData);
}
