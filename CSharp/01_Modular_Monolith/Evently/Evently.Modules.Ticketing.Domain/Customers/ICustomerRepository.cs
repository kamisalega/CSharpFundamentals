namespace Evently.Modules.Ticketing.Domain.Customers;

public interface ICustomerRepository
{
    Task<Customer?> GetAsync(Guid customerId, CancellationToken cancellationToken);
    void Insert(Customer customer);
}
