const activationSuccessHTML = (loginUrl: string) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <title>Account Activated</title>
    <style>
        body {
            font-family: "Arial", sans-serif;
            margin: 0;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: #f0f2f5;
        }

        .contentForm {
            background-color: #e1e3e8;
            padding: 2rem;
            border-radius: 1rem;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            width: 360px;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
        }

        .formTitle {
            font-size: 1.6rem;
            color: #2c3e50;
            margin-bottom: 1rem;
        }

        .success {
            color: #27ae60;
            font-size: 1rem;
            margin-bottom: 1rem;
        }

        .redirect-info {
            font-size: 0.875rem;
            color: #34495e;
            margin-bottom: 1.5rem;
        }

        .btn {
            padding: 0.6rem 1.2rem;
            background-color: #3b4a5a;
            color: #fff;
            border: none;
            border-radius: 0.5rem;
            font-weight: bold;
            font-size: 0.95rem;
            cursor: pointer;
            text-decoration: none;
            transition: background-color 0.2s ease;
        }

        .btn:hover {
            background-color: #2c3e50;
        }
    </style>
</head>
<body>
    <div class="contentForm">
        <h1 class="formTitle">Account activated!</h1>
        <p class="success">You can now log in to Pixel Place</p>
        <p class="redirect-info">Redirecting in 3 seconds...</p>
        <a href="${loginUrl}" class="btn">Log in now</a>
    </div>
    <script>
        setTimeout(() => {
            window.location.href = "${loginUrl}";
        }, 3000);
    </script>
</body>
</html>
`;

export { activationSuccessHTML };
