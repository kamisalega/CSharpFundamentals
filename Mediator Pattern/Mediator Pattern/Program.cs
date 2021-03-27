using System;

namespace Mediator_Pattern
{
    class Program
    {
        static void Main(string[] args)
        {
            var mediator = new ConcreteMediator();
            // var c1 = new Colleague1();
            // var c2 = new Colleague2();
            // mediator.Colleague1 = c1;
            // mediator.Colleague2 = c2;

            // mediator.Register(c1);
            // mediator.Register(c2);

            var c1 = mediator.CreateColleague<Colleague1>();
            var c2 = mediator.CreateColleague<Colleague2>();;

            c1.Send("Hello, world! (from c1)");
            c2.Send("Hi, there! (from c2)");
        }
    }
}
