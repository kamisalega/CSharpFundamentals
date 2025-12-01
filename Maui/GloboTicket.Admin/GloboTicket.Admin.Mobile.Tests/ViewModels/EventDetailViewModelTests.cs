using GloboTicket.Admin.Mobile.Repositories;
using GloboTicket.Admin.Mobile.Services;
using GloboTicket.Admin.Mobile.ViewModels;
using NSubstitute;

namespace GloboTicket.Admin.Mobile.Tests.ViewModels
{
    public class EventDetailViewModelTests
    {
        [Fact]
        public async Task EventDetailWithId_IsInitialized_GetEventIsCalled()
        {
            // Arrange
            var id = Guid.NewGuid();
            var eventService = Substitute.For<IEventService>();
            var navigationService = Substitute.For<INavigationService>();
            var dialogService = Substitute.For<IDialogService>();
            var sut = new EventDetailViewModel(eventService, navigationService, dialogService);
            sut.Id = id;
            // Act
            await sut.LoadAsync();
            // Assert
            await eventService.Received(1)
                .GetEvent(id);
        }

        [Fact]
        public async Task EventDetailWithGuidEmptyId_IsInitialized_GetEventIsNotCalled()
        {
            // Arrange
            var id = Guid.Empty;
            var eventService = Substitute.For<IEventService>();
            var navigationService = Substitute.For <INavigationService> ();
            var dialogService = Substitute.For<IDialogService>();
            var sut = new EventDetailViewModel(eventService, navigationService, dialogService);
            sut.Id = id;
            // Act
            await sut.LoadAsync();
            // Assert
            await eventService
                .DidNotReceive()
                .GetEvent(Arg.Any<Guid>());
        }
}
}