namespace Mediator_Pattern
{
    public class ConcreteMediator : Mediator
    {
        public Colleague1 Colleague1 { get; set; }
        public Colleague2 Colleague2 { get; set; }


        public override void Send(string message, Colleague colleague)
        {
            if (colleague == this.Colleague1)
            {
                this.Colleague2.HandleNotification(message);
            }
            else
            {
                this.Colleague1.HandleNotification(message);
            }
        }
    }
}
