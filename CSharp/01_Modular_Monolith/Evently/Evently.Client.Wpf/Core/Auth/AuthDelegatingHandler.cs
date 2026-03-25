using System.Net.Http;

namespace Evently.Client.Wpf.Core.Auth;

public sealed class AuthDelegatingHandler(TokenStore tokenStore) : DelegatingHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        if (tokenStore.AccessToken is not null)
        {
            request.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenStore.AccessToken);
        }
        
        return base.SendAsync(request, cancellationToken);
    }
}
