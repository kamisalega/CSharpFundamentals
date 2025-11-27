using System.Net.Http.Json;
using System.Text.Json;
using GloboTicket.Admin.Mobile.Models;

namespace GloboTicket.Admin.Mobile.Repositories
{
    public class CategoryRepository : ICategoryRepository
    {
        private readonly IHttpClientFactory _httpClientFactory;

        public CategoryRepository(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }
        public async Task<List<CategoryModel>> GetCategories()
        {
            using HttpClient client = _httpClientFactory.CreateClient("GloboTicketAdminApiClient");

            try
            {
                List<CategoryModel>? categories = await client.GetFromJsonAsync<List<CategoryModel>>(
                    $"categories", new JsonSerializerOptions(JsonSerializerDefaults.Web));
                return categories ?? new List<CategoryModel>();
            }
            catch (Exception e)
            {

                return new List<CategoryModel>();
            }
        }
    }
}
