using GloboTicket.Admin.Mobile.ViewModels;
using System.Globalization;

namespace GloboTicket.Admin.Mobile.Converters
{
    internal class StatusEnumToTextConverter : IValueConverter
    {
        public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            if (value is not EventStatusEnum status)
            {
                return string.Empty;
            }

            return status switch
            {
                EventStatusEnum.OnSale => "On sale",
                EventStatusEnum.AlmostSoldOut => "Almost sold out",
                EventStatusEnum.SalesClosed => "Ticket sale is closed",
                EventStatusEnum.Cancelled => "Cancelled",
                _ => string.Empty
            };
        }

      

        public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}
