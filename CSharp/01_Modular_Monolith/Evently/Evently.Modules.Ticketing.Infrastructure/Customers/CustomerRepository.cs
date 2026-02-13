using Evently.Modules.Ticketing.Domain.Customers;
using Evently.Modules.Ticketing.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace Evently.Modules.Ticketing.Infrastructure.Customers;

internal sealed class CustomerRepository(TicketingDBContext context) : ICustomerRepository
{
    public async Task<Customer?> GetAsync(Guid customerId, CancellationToken cancellationToken)
    {
        return await context.Customers.SingleOrDefaultAsync(c => c.Id == customerId, cancellationToken);
    }

    public void Insert(Customer customer)
    {
        context.Customers.Add(customer);
    }
}
