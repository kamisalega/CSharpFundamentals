using CommunityToolkit.Maui;
using GloboTicket.Admin.Mobile.Repositories;
using GloboTicket.Admin.Mobile.Services;
using GloboTicket.Admin.Mobile.ViewModels;
using GloboTicket.Admin.Mobile.Views;
using Microsoft.Extensions.Logging;
namespace GloboTicket.Admin.Mobile
{
    public static class MauiProgram
    {
        public static MauiApp CreateMauiApp()
        {
            var builder = MauiApp.CreateBuilder();
            builder
                .UseMauiApp<App>()
                .UseMauiCommunityToolkit()
                .ConfigureFonts(fonts =>
                {
                    fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
                    fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
                    fonts.AddFont("MaterialIcons-Regular.ttf", "MaterialIconsRegular");
                }).RegisterRepositories()
                .RegisterServices()
                .RegisterViews()
                .RegisterViewModels();

#if DEBUG
            builder.Logging.AddDebug();
#endif

            return builder.Build();
        }

        private static MauiAppBuilder RegisterRepositories(this MauiAppBuilder builder)
        {
            builder.Services.AddTransient<IEventRepository, EventRepository>();
            builder.Services.AddTransient<ICategoryRepository, CategoryRepository>();
            
            var baseUrl = DeviceInfo.Platform == DevicePlatform.Android
                ? "http://10.0.2.2:5191"
                : "https://localhost:7185";

            builder.Services.AddHttpClient("GloboTicketAdminApiClient",
                client =>
                {
                    client.BaseAddress = new Uri(baseUrl);
                    client.DefaultRequestHeaders.Add("Accept", "application/json");

                });
            return builder;
        }

        private static MauiAppBuilder RegisterViewModels(this MauiAppBuilder builder)
        {
            builder.Services.AddSingleton<EventListOverviewViewModel>();

            builder.Services.AddTransient<EventDetailViewModel>();
            builder.Services.AddTransient<EventAddEditViewModel>();
            return builder;
        }

        private static MauiAppBuilder RegisterServices(this MauiAppBuilder builder)
        {
            builder.Services.AddTransient<IEventService, EventService>();
            builder.Services.AddSingleton<INavigationService, NavigationService>();
            builder.Services.AddTransient<ICategoryService, CategoryService>();
            builder.Services.AddSingleton<IDialogService, DialogService>();
            return builder;
        }

        private static MauiAppBuilder RegisterViews(this MauiAppBuilder builder)
        {
            builder.Services.AddSingleton<EventOverViewPage>();
            builder.Services.AddTransient<EventDetailPage>();
            builder.Services.AddTransient<EventAddEditPage>();
            return builder;
        }
    }
}
