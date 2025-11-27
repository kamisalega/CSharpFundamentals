using GloboTicket.Admin.Mobile.Models;
using GloboTicket.Admin.Mobile.Repositories;

namespace GloboTicket.Admin.Mobile.Services;

public class CategoryService : ICategoryService
{
    private readonly ICategoryRepository _categoryRepository;

    public CategoryService(ICategoryRepository categoryRepository)
    {
        _categoryRepository = categoryRepository;
    }
    public Task<List<CategoryModel>> GetCategories()
    {
        return _categoryRepository.GetCategories();
    }
}