using System.Windows.Interop;

namespace Evently.Client.Wpf.Core;
public interface IEffect<TMsg>
{
    Task<TMsg?> ExecuteAsync(CancellationToken cancellation = default);
}
