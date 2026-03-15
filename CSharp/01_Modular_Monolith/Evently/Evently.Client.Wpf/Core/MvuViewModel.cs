using System.Reactive.Linq;
using System.Reactive.Subjects;
using System.Windows;
using System.Windows.Threading;
using CommunityToolkit.Mvvm.ComponentModel;

namespace Evently.Client.Wpf.Core;

public abstract class MvuViewModel<TModel, TMsg> : ObservableObject, IDisposable where TModel : notnull
{

    private TModel _model;
    private readonly Dispatcher _dispatcher = Application.Current.Dispatcher;
    private CancellationTokenSource _effectCts = new();
    private bool _disposed;

    protected MvuViewModel(TModel initialModel)
    {
        _model = initialModel;
       
    }

    public TModel Model
    {
        get => _model;
        private set => SetProperty(ref _model, value);
    }

    protected abstract (TModel NewModel, IEffect<TMsg>? Effect) Update(TModel model, TMsg message);

    public void Dispatch(TMsg message)
    {
        if (!_dispatcher.CheckAccess())
        {
            _dispatcher.Invoke(() => Dispatch(message));
            return;
        }

        (TModel newModel, IEffect<TMsg>? effect) = Update(Model, message);
        Model = newModel;

        if (effect is not null)
        {
            _ = ExecuteEffectAsync(effect);
        }
    }

    private async Task ExecuteEffectAsync(IEffect<TMsg> effect)
    {
        try
        {
            TMsg? resultMsg = await effect.ExecuteAsync(_effectCts.Token);
            if (resultMsg is not null)
            {
                Dispatch(resultMsg);
            }
        }
        catch (Exception exception)
        {
            TMsg? errorMsg = CreateErrorMessage(exception);
            if (errorMsg is not null)
            {
                Dispatch(errorMsg);
            }
        }
    }

    protected virtual TMsg? CreateErrorMessage(Exception ex) =>
        default;

    public void CancelEffects()
    {
        _effectCts.Cancel();
        _effectCts.Dispose();
        _effectCts = new CancellationTokenSource();
    }

    public void Dispose()
    {
        if (!_disposed)
        {
            CancelEffects();
            _disposed = true;
        }
    }
}


