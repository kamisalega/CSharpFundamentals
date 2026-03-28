namespace CSharpPerformancePlaybook.Code;

public class ClassVsStruct
{
    private readonly IReadOnlyList<string> _names;

    public ClassVsStruct(IReadOnlyList<string> names)
    {
        _names = names;
    }

    public List<PersonClass> BuildPersonClass()
    {
        return _names.Select(x => new PersonClass { Name = x }).ToList();
    }

    public List<PersonStruct> BuildPersonStruct()
    {
        return _names.Select(x => new PersonStruct { Name = x }).ToList();
    }

    public List<PersonRecordStruct> BuildPersonRecordStruct()
    {
        return _names.Select(x => new PersonRecordStruct(Name: x)).ToList();
    }

    public List<PersonRecord> BuildPersonRecord()
    {
        return _names.Select(x => new PersonRecord(Name: x)).ToList();
    }
}