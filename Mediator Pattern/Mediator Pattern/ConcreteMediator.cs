using System.Collections.Generic;
using System.Linq;

namespace Mediator_Pattern
{
    public class ConcreteMediator : Mediator
    {
        // public Colleague1 Colleague1 { get; set; }
        // public Colleague2 Colleague2 { get; set; }

        private List<Colleague> _colleagues = new List<Colleague>();

        public void Register(Colleague colleague)
        {
            colleague.SetMediator(this);
            this._colleagues.Add(colleague);
        }

        public T CreateColleague<T>() where T : Colleague, new()
        {
            var c = new T();
            c.SetMediator(this);
            this._colleagues.Add(c);
            return c;
        }

        public override void Send(string message, Colleague colleague)
        {
            this._colleagues.Where(c => c != colleague)
                .ToList().ForEach(c=> c.HandleNotification(message));
        }
    }
}


