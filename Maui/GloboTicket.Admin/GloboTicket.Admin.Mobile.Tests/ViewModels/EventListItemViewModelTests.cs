using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using GloboTicket.Admin.Mobile.ViewModels;

namespace GloboTicket.Admin.Mobile.Tests.ViewModels
{
    public class EventListItemViewModelTests
    {
        public static TheoryData<Guid, string?, string?, double, DateTime?, EventStatusEnum,
            List<string>?, CategoryViewModel?> Cases =
            new()
            {
                {
                    Guid.NewGuid(), "imageUrl1", "Event1", 10, DateTime.UtcNow, EventStatusEnum.AlmostSoldOut,
                    ["Artists1"], new CategoryViewModel { Id = Guid.NewGuid(), Name = "Category1" }
                },
                {
                    Guid.NewGuid(), "imageUrl2", "Event2", 20, DateTime.MaxValue, EventStatusEnum.Cancelled,
                    ["Artists2"],
                    new CategoryViewModel { Id = Guid.NewGuid(), Name = "Category2" }
                },
                {
                    Guid.Empty, null, null, 0, DateTime.MinValue, EventStatusEnum.SalesClosed,
                    null, null
                }
            };
        [Theory, MemberData(nameof(Cases))]
        public void EventListItem_Initialized_PropertiesCorrectlySet(Guid id, string? imageUrl,
            string? name,
            double price, DateTime date, EventStatusEnum status, List<string>? artists,
            CategoryViewModel? category)
        {
            // Arrange
            // Act
            var sut = new EventListItemViewModel(id, name, price, date, artists, status, imageUrl, category);
            // Assert
            Assert.Equal(id, sut.Id);
            Assert.Equal(name, sut.Name);
            Assert.Equal(price, sut.Price);
            Assert.Equal(date, sut.Date);
            Assert.Equal(artists, sut.Artists);
            Assert.Equal(status, sut.Status);
            Assert.Equal(imageUrl, sut.ImageUrl);
            Assert.Equal(category, sut.Category);
        }
    }
}