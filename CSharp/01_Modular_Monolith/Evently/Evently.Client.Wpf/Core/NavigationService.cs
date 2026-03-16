using System.Windows;

namespace Evently.Client.Wpf.Core;

public sealed class NavigationService
{
    private readonly Dictionary<Type, Func<object>> _viewModelFactories = new Dictionary<Type, Func<object>>();

    private Action<object>? _onNavigate;

    public void Register<TViewModel>(Func<TViewModel> factory) where TViewModel : notnull
        => _viewModelFactories[typeof(TViewModel)] = () => factory();

    public void SetNavigationCallback(Action<object> onNavigate) => _onNavigate = onNavigate;

    public void NavigateTo<TViewModel>(Action<object>? configure = null) where TViewModel : notnull
    {
        if (!_viewModelFactories.TryGetValue(typeof(TViewModel), out Func<object>? factory))
        {
            throw new InvalidOperationException($"No factory registered for {typeof(TViewModel).Name}");
        }

        object view = factory();
        configure?.Invoke(view);
        _onNavigate?.Invoke(view);

        if (view is FrameworkElement { DataContext: IInitializable initializable })
        {
            initializable.Initialize();
        }
    }
}
