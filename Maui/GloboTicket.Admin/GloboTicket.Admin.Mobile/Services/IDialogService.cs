namespace GloboTicket.Admin.Mobile.Services;

public interface IDialogService
{
    Task<bool> Ask(string title, string message, string trueButtonText = "Yes", string falseButtonText = "No");
    Task Notify(string title, string message, string buttonText = "OK");
}