using System.Reactive.Concurrency;
using System.Reactive.Disposables;
using System.Reactive.Linq;
using System.Reactive.Subjects;
using CommunityToolkit.Mvvm.ComponentModel;

namespace Evently.Client.Wpf.Core;

public abstract class MvuViewModel<TModel, TMsg> : ObservableObject, IDisposable where TModel : notnull
{
    private readonly Subject<TMsg> _messages = new();
    private readonly CompositeDisposable _disposables = new();
    private readonly SerialDisposable _effectSubscription = new();
    private TModel _model;
    private bool _disposed;

    protected MvuViewModel(TModel initialModel)
    {
        _model = initialModel;
        SynchronizationContext context = SynchronizationContext.Current
                                         ?? throw new InvalidOperationException("MvuViewModel must be created on the UI thread.");

        var uiScheduler = new SynchronizationContextScheduler(context);
        _messages.ObserveOn(uiScheduler)
            .Scan(initialModel, (model, msg) =>
            {
                (TModel newModel, IObservable<TMsg>? effect) = Update(model, msg);
                SubscribeToEffect(effect, uiScheduler);
                return newModel;
            }).Subscribe(onNext: newModel => Model = newModel,
                onError: ex => System.Diagnostics.Debug.WriteLine($"[MVU Fatal] {ex}"));

        _effectSubscription.DisposeWith(_disposables);
    }

    protected IObservable<TMsg> Messages => _messages;
    protected CompositeDisposable Disposables => _disposables;

    public TModel Model
    {
        get => _model;
        private set => SetProperty(ref _model, value);
    }

    protected abstract (TModel NewModel, IObservable<TMsg>? Effect) Update(TModel model, TMsg message);

    public void Dispatch(TMsg message) =>
        _messages.OnNext(message);

    private void SubscribeToEffect(IObservable<TMsg>? effect, IScheduler uiSheduler)
    {
        if (effect is null)
        {
            return;
        }

        _effectSubscription.Disposable = effect
            .ObserveOn(uiSheduler)
            .Subscribe(
                onNext: msg => Dispatch(msg),
                onError: ex =>
                {
                    TMsg? errorMsg = CreateErrorMessage(ex);
                    if (errorMsg is not null)
                    {
                        Dispatch(errorMsg);
                    }
                });
    }

    protected virtual TMsg? CreateErrorMessage(Exception ex) =>
        default;

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposables.Dispose();
        _messages.Dispose();
        _disposed = true;
    }
}
