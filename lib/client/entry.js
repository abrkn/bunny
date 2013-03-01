var dev = window.location.hostname == 'localhost'
 ref = new Firebase(dev ? 'https://bunny-dev.firebaseio.com' : 'https://bunny.firebaseio.com')
, shared = require('./shared')
, $app = $('#app')
, tableRef = ref.child('tables/0')
, Table = require('./Table')
, $table = $app.find('.table')
, table = new Table($table, tableRef)

console.log('dev?', dev)

shared.authClient = new FirebaseAuthClient(ref, onAuth)

$app.append(table.$el)

$app.on('click', '#auth .login', onClickLogin)
.on('click', '#auth .logout', onClickLogout)
.on('click', '#auth .register', onClickRegister)

function onClickRegister() {
    console.log($app.find('#auth .email').val())
    shared.authClient.createUser(
        $app.find('#auth .email').val(),
        $app.find('#auth .password').val(),
        function(error, user) {
            if (error) return alert(error.code || error)
            console.log('register success')
            onClickLogin()
        }
    )
}

function onClickLogout() {
    shared.authClient.logout()
}

function onClickLogin() {
    shared.authClient.login('password', {
        email: $app.find('#auth .email').val(),
        password: $app.find('#auth .password').val()
    })
}

function onAuth(error, u) {
    if (error) return alert(error)
    shared.user = u
    $app.toggleClass('logged-in', !!u)
    u && $app.find('#auth .logged-in .username').html(u.id)
}
