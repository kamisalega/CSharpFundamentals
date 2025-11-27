using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using GloboTicket.Admin.Mobile.Models;

namespace GloboTicket.Admin.Mobile.Services
{
    public interface ICategoryService
    {
        Task<List<CategoryModel>> GetCategories();
    }
}
