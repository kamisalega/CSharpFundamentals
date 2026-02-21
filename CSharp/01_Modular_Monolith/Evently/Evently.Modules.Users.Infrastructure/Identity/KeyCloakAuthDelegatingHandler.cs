using System.Net.Http.Headers;
using Microsoft.Extensions.Options;

namespace Evently.Modules.Users.Infrastructure.Identity;

internal sealed class KeyCloakAuthDelegatingHandler(IOptions<KeyCloakOptions> options) : DelegatingHandler
{
    private readonly KeyCloakOptions _options = options.Value;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        AuthToken authorizationToken = await GetAuthoriaztionToken(cancellationToken);

        request.Headers.Authorization = 
            new AuthenticationHeaderValue("Bearer", authorizationToken.AccessToken);
        
        
        return base.SendAsync(request, cancellationToken);
    }

    private Task<AuthToken> GetAuthoriaztionToken(CancellationToken cancellationToken)
    {
        var authRequestParameters = new KeyValuePair<String, string>
        
        return 
    }
}

internal sealed class AuthToken
{
    public string? AccessToken { get; private set; }
}

internal class KeyCloakOptions
{
}
