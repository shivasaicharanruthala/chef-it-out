const Joi = require("@hapi/joi");

const customerSchema = Joi.object({
  firstName: Joi.string()
    .min(3)
    .max(30)
    .required()
    .error(new Error("firstname should be 3-30 characters")),

  lastName: Joi.string()
    .min(3)
    .max(30)
    .required()
    .error(new Error("lastname should be 3-30 characters")),

  phoneNum: Joi.string()
    .pattern(/^\d{10}$/)
    .required()
    .error(new Error("phone number should be 10 digits")),

  internalAuth: {
    hashedPassword: Joi.string()
      .pattern(/^(?=.*\d)(?=.*[!@#$%^&*])(?=.*[a-z])(?=.*[A-Z]).{8,}$/)
      .required()
      .error(
        new Error(
          "password should be of length 8 and should contain atleast one digit one lowercase or uppercase and one special character"
        )
      ),

    passwordResetToken: Joi.string(),
  },

  email: Joi.string().email({
    minDomainSegments: 2,
    tlds: { allow: ["com", "net"] },
  }),
});

module.exports = customerSchema;
