// Initialize One Tap Login
google.accounts.id.initialize({
    client_id: "357646370909-ud4dbtmqh6euc6dutpahju5h25bq4s2i.apps.googleusercontent.com",
    callback: handleCredentialResponse
  });
  
  
  // Show the One Tap UI
  google.accounts.id.prompt();
  
  // Callback function when user logs in via One Tap
  function handleOneTapLogin(response) {
      const id_token = response.credential;
      fetch('/onetap-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: id_token })
      })
      .then(res => res.json())
      .then(data => {
          // Redirect to mandatory Gmail OAuth after One Tap login
          window.location.href = '/authorize_gmail';
      })
      .catch(err => console.error('Error:', err));
  }
  