using System.Net.Http;
using System.Windows;
using Evently.Client.Wpf.ApiClient;
using Evently.Client.Wpf.Core;
using Evently.Client.Wpf.Core.Auth;
using Evently.Client.Wpf.Features.Events;
using Evently.Client.Wpf.Features.Login;
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
            .AddHttpMessageHandler<AuthDelegatingHandler>()
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
            {
#pragma warning disable S4830
                ServerCertificateCustomValidationCallback =
#pragma warning restore S4830
                    HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
            });

        services.AddHttpClient<LoginApiClient>(client =>
            {
                client.BaseAddress = new Uri("http://localhost:18080");
            })
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
            {
#pragma warning disable S4830
                ServerCertificateCustomValidationCallback =
#pragma warning restore S4830
                    HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
            });

        services.AddSingleton<NavigationService>();
        services.AddSingleton<TokenStore>();
        
        services.AddTransient<AuthDelegatingHandler>();
        services.AddTransient<EventListViewModel>();
        services.AddTransient<EventListView>();
        services.AddTransient<EventDetailViewModel>();
        services.AddTransient<EventDetailView>();

        services.AddTransient<LoginView>();
        services.AddTransient<LoginViewModel>();
        
        services.AddSingleton<MainWindow>();
    }

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        NavigationService navigation = _serviceProvider.GetRequiredService<NavigationService>();
        navigation.Register(() => _serviceProvider.GetRequiredService<EventListView>());
        navigation.Register(() => _serviceProvider.GetRequiredService<EventDetailView>());
        navigation.Register(() => _serviceProvider.GetRequiredService<LoginView>());

        MainWindow mainWindow = _serviceProvider.GetRequiredService<MainWindow>();
        mainWindow.Show();

        navigation.NavigateTo<LoginView>();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _serviceProvider.Dispose();
        base.OnExit(e);
    }
}
