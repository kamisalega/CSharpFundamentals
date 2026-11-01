using MediatR;
using StranglerFig.Common.Domain;

namespace StranglerFig.Common.Application.Messaging;

public interface IQuery<TResponse> : IRequest<Result<TResponse>>;
