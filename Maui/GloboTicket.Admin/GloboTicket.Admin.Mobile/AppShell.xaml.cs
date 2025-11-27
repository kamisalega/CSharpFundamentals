using GloboTicket.Admin.Mobile.Views;

namespace GloboTicket.Admin.Mobile
{
    public partial class AppShell : Shell
    {
        public AppShell()
        {
            InitializeComponent();

            Routing.RegisterRoute("event", typeof(EventDetailPage));
        }
    }
}
