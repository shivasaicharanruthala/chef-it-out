var nodemailer = require("nodemailer");

var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'cioservice01@gmail.com',
        pass: 'kevindota02'
    }
});

function send_mail(body, to_email) {

    mailOptions = {
        from: 'cioservice01@gmail.com',
        to: to_email,
        subject: "Please confirm your Email account",
        html: body
    }

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });

}

function send_verification_token(token, to_email) {
    const body = "Hello,<br> Please Click on the link to verify your email.<br><br><strong>"+token+"</strong>."
    send_mail(body, to_email)

}

module.exports = { send_mail, send_verification_token}
