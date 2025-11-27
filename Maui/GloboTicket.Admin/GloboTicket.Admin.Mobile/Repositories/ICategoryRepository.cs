using GloboTicket.Admin.Mobile.Models;

namespace GloboTicket.Admin.Mobile.Repositories
{
    public interface ICategoryRepository
    {
        Task<List<CategoryModel>> GetCategories();
    }
}
