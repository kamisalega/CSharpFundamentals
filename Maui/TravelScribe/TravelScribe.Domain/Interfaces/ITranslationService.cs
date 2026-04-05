using TravelScribe.Domain.Models;

namespace TravelScribe.Domain.Interfaces;

public interface ITranslationService : IDisposable
{
    Task<GeneratedDescription> TranslateAsync(
        GeneratedDescription sourceDescription,
        Language targetLanguage);
    Task<List<GeneratedDescription>> TranslateToAllLanguagesAsync(
        GeneratedDescription sourceDescription);
}
