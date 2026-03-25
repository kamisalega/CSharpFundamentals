using Evently.Client.Wpf.ApiClient.Dtos;
using Evently.Client.Wpf.Features.Login;
using FluentAssertions;

namespace Evently.Client.Wpf.Tests.Features.Login;

public sealed class LoginUpdateTests
{
    [Fact]
    public void Update_WhenEmailChanged_ShouldUpdateEmail()
    {
        // Arrange
        LoginModel model = LoginModel.Empty;

        // Act
        (LoginModel newModel, IObservable<LoginMsg>? effect) = LoginUpdate.Update(model,
            new LoginMsg.EmailChanged("kamilsalega@gmail.com"),
            LoginApiClientStub.Create());

        //Assert
        newModel.IsLoading.Should().BeFalse();
        newModel.Email.Should().Be("kamilsalega@gmail.com");
        newModel.Error.Should().BeNull();
        effect.Should().BeNull();
    }

    [Fact]
    public void Update_WhenPasswordChanged_ShouldUpdatePassword()
    {
        // Arrange
        LoginModel model = LoginModel.Empty;
        string password = "passwordTest";

        // Act
        (LoginModel newModel, IObservable<LoginMsg>? effect) = LoginUpdate.Update(model,
            new LoginMsg.PasswordChanged(password),
            LoginApiClientStub.Create());

        //Assert
        newModel.IsLoading.Should().BeFalse();
        newModel.Password.Should().Be(password);
        newModel.Error.Should().BeNull();
        effect.Should().BeNull();
    }


    [Fact]
    public void Update_WhenSubmit_ShouldSetIsLoadingAndClearError()
    {
        // Arrange
        LoginModel model = LoginModel.Empty with
        {
            Email = "kamilsalega@gmail.com",
            Password = "password123"
        };

        // Act
        (LoginModel newModel, IObservable<LoginMsg>? effect) = LoginUpdate.Update(model,
            new LoginMsg.Submit(),
            LoginApiClientStub.Create());

        //Assert
        newModel.IsLoading.Should().BeTrue();
        newModel.Error.Should().BeNull();
        effect.Should().NotBeNull();
    }

    [Fact]
    public void Update_WhenSubmitWithEmptyPassword_ShouldSetValidationError()
    {
        // Arrange
        LoginModel model = LoginModel.Empty with { Email = "kamilsalega@gmail.com", Password = "" };

        // Act
        (LoginModel newModel, IObservable<LoginMsg>? effect) = LoginUpdate.Update(model,
            new LoginMsg.Submit(),
            LoginApiClientStub.Create());

        //Assert
        newModel.IsLoading.Should().BeFalse();
        newModel.Error.Should().NotBeNullOrEmpty();
        effect.Should().BeNull();
    }

    [Fact]
    public void Update_WhenSubmitWithEmptyEmail_ShouldSetValidationError()
    {
        // Arrange
        LoginModel model = LoginModel.Empty with { Password = "password123"};

        // Act
        (LoginModel newModel, IObservable<LoginMsg>? effect) = LoginUpdate.Update(model,
            new LoginMsg.Submit(),
            LoginApiClientStub.Create());

        //Assert
        newModel.IsLoading.Should().BeFalse();
        newModel.Error.Should().NotBeNullOrEmpty();
        effect.Should().BeNull();
    }

    [Fact]
    public void Update_WhenLoginSuccess_ShouldClearLoading()
    {
        // Arrange
        LoginModel model = LoginModel.Empty with { Email = "kamil@gmail.com" };

        // Act
        (LoginModel newModel, IObservable<LoginMsg>? effect) = LoginUpdate.Update(model,
            new LoginMsg.LoginSuccess("accessToken", "refreshToken"),
            LoginApiClientStub.Create());

        //Assert
        newModel.IsLoading.Should().BeFalse();
        newModel.Error.Should().BeNull();
        effect.Should().BeNull();
    }

    [Fact]
    public void Update_WhenLoginFailed_ShouldSetErrorAndClearLoading()
    {
        // Arrange
        LoginModel model = LoginModel.Empty;

        // Act
        (LoginModel newModel, IObservable<LoginMsg>? effect) = LoginUpdate.Update(model,
            new LoginMsg.LoginFailed("Invalid credentials"),
            LoginApiClientStub.Create());

        //Assert
        newModel.IsLoading.Should().BeFalse();
        newModel.Error.Should().Be("Invalid credentials");
        effect.Should().BeNull();
    }
}
