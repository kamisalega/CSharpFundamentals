using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DelegatesAndEvents
{
    public delegate int WorkPerformedHandler(int hours, WorkType workType);

    class Program
    {
        static void Main(string[] args)
        {
            var del1 = new WorkPerformedHandler(WorkPerformed1);
            var del2 = new WorkPerformedHandler(WorkPerformed2);
            var del3 = new WorkPerformedHandler(WorkPerformed3);

            del1 += del2 + del3;


            int finalHours = del1(10, WorkType.GenerateReports);
            Console.WriteLine(finalHours);

            DoWork(del2);

            Console.Read();
        }

        private static int WorkPerformed3(int hours, WorkType worktype)
        {
            Console.WriteLine("WorkPerformed3 called" + hours.ToString());

            return hours + 3;
        }

        static void DoWork(WorkPerformedHandler del)
        {
            del(5, WorkType.GoToMeetings);
        }

        static int WorkPerformed2(int hours, WorkType workType)
        {
            Console.WriteLine("WorkPerformed2 called" + hours.ToString());

            return hours + 2;
        }
        static int WorkPerformed1(int hours, WorkType workType)
        {
            Console.WriteLine("WorkPerformed1 called" + hours.ToString());

            return hours + 1;
        }
    }

    public enum WorkType
    {
        GoToMeetings,
        Golf,
        GenerateReports
    }
}
