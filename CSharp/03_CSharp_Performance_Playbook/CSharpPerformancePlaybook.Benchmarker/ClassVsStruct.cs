using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Mathematics;
using BenchmarkDotNet.Order;

namespace CSharpPerformancePlaybook.Benchmarker;

[Orderer(SummaryOrderPolicy.FastestToSlowest)]
[RankColumn(NumeralSystem.Arabic)]
public class ClassVsStruct
{
    public List<string> Names => File.ReadAllLines("Resources/1000_imion.txt").ToList();


    [Benchmark]
    public void ThousandClasses()
    {
         var personClass = new Code.ClassVsStruct(Names).BuildPersonClass();

         for (int i = 0; i < personClass.Count; i++)
         {
             string personName = personClass.ElementAt(i).Name;
         }
    }

    [Benchmark]
    public void ThousandStructs()
    {
        var personStruct = new Code.ClassVsStruct(Names).BuildPersonStruct();

        for (int i = 0; i < personStruct.Count; i++)
        {
            string personName = personStruct.ElementAt(i).Name;
        }
    }


    [Benchmark]
    public void ThousandRecordStructs()
    {
        var personRecordStruct = new Code.ClassVsStruct(Names).BuildPersonRecordStruct();

        for (int i = 0; i < personRecordStruct.Count; i++)
        {
            string personName = personRecordStruct.ElementAt(i).Name;
        }
    }


    [Benchmark]
    public void ThousandRecord()
    {
        var personRecord = new Code.ClassVsStruct(Names).BuildPersonRecord();

        for (int i = 0; i < personRecord.Count; i++)
        {
            string personName = personRecord.ElementAt(i).Name;
        }
    }
}