using System.Net.Http;
using System.Windows;
using Evently.Client.Wpf.ApiClient;
using Evently.Client.Wpf.Core;
using Evently.Client.Wpf.Features.Events;
using Microsoft.Extensions.DependencyInjection;

namespace Evently.Client.Wpf;

public partial class App : Application
{
    private readonly ServiceProvider _serviceProvider;

    public App()
    {
        var services = new ServiceCollection();
        ConfigurationServices(services);
        _serviceProvider = services.BuildServiceProvider();
    }

    private static void ConfigurationServices(IServiceCollection services)
    {
        services.AddHttpClient<EventlyApiClient>(client =>
            {
                client.BaseAddress = new Uri("https://localhost:5001");
            })
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
            {
#pragma warning disable S4830
                ServerCertificateCustomValidationCallback =
#pragma warning restore S4830
                    HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
            });

        services.AddSingleton<NavigationService>();

        services.AddTransient<EventListViewModel>();
        services.AddTransient<EventListView>();
        services.AddTransient<EventDetailViewModel>();
        services.AddTransient<EventDetailView>();

        services.AddSingleton<MainWindow>();
    }

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        NavigationService navigation = _serviceProvider.GetRequiredService<NavigationService>();
        navigation.Register(() => _serviceProvider.GetRequiredService<EventListView>());
        navigation.Register(() => _serviceProvider.GetRequiredService<EventDetailView>());

        MainWindow mainWindow = _serviceProvider.GetRequiredService<MainWindow>();
        mainWindow.Show();

        navigation.NavigateTo<EventListView>();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _serviceProvider.Dispose();
        base.OnExit(e);
    }
}
