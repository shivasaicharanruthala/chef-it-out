const express = require("express");
const router = express.Router();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const auth = require("../middleware_jwt");
const speakeasy = require("speakeasy");
const passport = require("passport");
const passportSetup = require("../../config/gOAuth/customerPassport");
const Customer = require("../../joi_models/customer.model");
const transactions = require("../transactions");
const passwordCheck = require("../../joi_models/passwordCheck.model");
const Order = require("../../models/transactions.model");
const email = require("../send_email");
const mongoose = require("mongoose");
const { User } = require("../../models/customer.model");
const { Chef } = require("../../models/chef.model");
const { contract } = require("../../models/customer.model");
// const {
//   default: Chef_auth,
// } = require("../../../src/authentication/Chef_login");

router.use(cors());

process.SECRET_KEY = "hackit";

/* Google Authentication API. */

router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/customer/auth/google",
    session: false,
  }),
  (req, res) => {
    const token = req.user;
    console.log("\n" + token + "\n");
    res.redirect("http://localhost:3000/" + `${token}`);
  }
);

function gen_OTP(secret_token) {
  var token = speakeasy.totp({
    secret: secret_token,
    encoding: "base32",
  });

  return token;
}

function verify_OTP(secret_token, OTP) {
  var tokenValidates = speakeasy.totp.verify({
    secret: secret_token,
    encoding: "base32",
    token: OTP,
    window: 3,
  });

  return tokenValidates;
}

router.post("/register", register);

function register(req, res) {
  User.findOne({
    email: req.body.email,
  })
    .then((user) => {
      if (user) {
        if (user.isVerified === false) {
          res
            .status(200)
            .send({ message: "Please verify your account!!!", status: "1" });
        } else {
          res.status(400).send({ message: "Account already exist" });
        }
      } else {
        var secret = speakeasy.generateSecret({ length: 20 });
        const userData = {
          firstName: req.body.firstname,
          lastName: req.body.lastname,
          email: req.body.email,
          phoneNum: req.body.phonenumber,
          internalAuth: {
            hashedPassword: req.body.hashedPassword,
            passwordResetToken: secret.base32,
          },
        };
        const { error, value } = Customer.validate(userData);

        if (error) {
          res.status(400).send({ message: error.message });
        } else {
          bcrypt.hash(req.body.hashedPassword, 10, (err, hash) => {
            userData.internalAuth.hashedPassword = hash;

            User.create(userData)
              .then((customer) => {
                var token = gen_OTP(customer.internalAuth.passwordResetToken);

                email.send_verification_token(token, customer.email);

                res
                  .status(200)
                  .send({ message: "Please enter OTP!!!", status: "1" });
              })
              .catch((err) => {
                res.status(400).send({
                  message: "Something went wrong, please try again!!!",
                });
              });
          });
        }
      }
    })
    .catch((err) => {
      res
        .status(400)
        .send({ message: "Something went wrong, please try again!!!" });
    });
}

router.post("/send_otp", resend);

function resend(req, res) {
  console.log("\n" + "send_otp called" + "\n");
  User.findOne({
    email: req.body.email,
  }).then((customer) => {
    if (!customer) {
      res.status(400).send({
        message: "account does not exist, please register!!!",
        status: "1",
      });
    } else {
      var secret = speakeasy.generateSecret({ length: 20 });

      const newValues = {
        $set: { "internalAuth.passwordResetToken": secret.base32 },
      };

      User.updateOne(
        {
          email: customer.email,
        },
        newValues,
        function (err, success) {
          if (err) {
            res
              .status(400)
              .send({ message: "Something went wrong, please try again!!!" });
          } else {
            var token = gen_OTP(secret.base32);

            email.send_verification_token(token, req.body.email);

            res.status(200).send("OTP sent!!!");
          }
        }
      );
    }
  });
}

router.post("/verify_registration_otp", verifyRegistrationOtp);

function verifyRegistrationOtp(req, res) {
  User.findOne({
    email: req.body.email,
  })
    .then((customer) => {
      if (!customer) {
        res
          .status(400)
          .send({ message: "account does not exist, please register!!!" });
      } else {
        var tokenValidates = verify_OTP(
          customer.internalAuth.passwordResetToken,
          req.body.OTP
        );

        if (!tokenValidates) {
          res.status(400).send({ message: "INVALID OTP!!!" });
        } else {
          const newValues = { $set: { isVerified: true } };

          User.updateOne({ _id: customer._id }, newValues, function (
            err,
            success
          ) {
            if (err) {
              res.status(400).send({
                message: "Something went wrong, please try again!!!",
              });
            } else {
              res.status(200).send("Successfully registered your account!!!");
            }
          });
        }
      }
    })
    .catch((err) => {
      res
        .status(400)
        .send({ message: "Something went wrong, please try again!!!" });
    });
}

router.post("/verify_reset_password_otp", verifyPasswordOtp);

function verifyPasswordOtp(req, res) {
  User.findOne({
    email: req.body.email,
  })
    .then((customer) => {
      if (!customer) {
        res
          .status(400)
          .send({ message: "account does not exist, please register!!!" });
      } else {
        var tokenValidates = verify_OTP(
          customer.internalAuth.passwordResetToken,
          req.body.OTP
        );

        if (!tokenValidates) {
          res.status(400).send({ message: "INVALID OTP!!!" });
        } else {
          const newValues = { $set: { isValidated: true, isVerified: true } };

          User.updateOne({ _id: customer._id }, newValues, function (
            err,
            success
          ) {
            if (err) {
              res.status(400).send({
                message: "Something went wrong, please try again!!!",
              });
            } else {
              res.status(200).send("Validated!!!");
            }
          });
        }
      }
    })
    .catch((err) => {
      res
        .status(400)
        .send({ message: "Something went wrong, please try again!!!" });
    });
}

router.post("/reset_password", reset);

function reset(req, res) {
  User.findOne({
    email: req.body.email,
  })
    .then((user) => {
      if (user.isValidated === true) {
        const { error, value } = passwordCheck.validate({
          password: req.body.newPassword,
        });

        if (error) {
          res.status(400).send({ message: error.message });
        } else {
          bcrypt.hash(req.body.newPassword, 10, (err, hash) => {
            if (err) {
              res
                .status(400)
                .send({ message: "Something went wrong, please try again!!!" });
            } else {
              const newValues = {
                $set: {
                  "internalAuth.hashedPassword": hash,
                  isValidated: false,
                },
              };

              User.updateOne(
                {
                  email: user.email,
                },
                newValues,
                function (err, success) {
                  if (err) {
                    // console.log("\n"+err+"\n");
                    res.status(400).send({
                      message: "Something went wrong, please try again!!!",
                    });
                  } else {
                    res.status(200).send("Password updated!!!");
                  }
                }
              );
            }
          });
        }
      } else {
        // In frontend check status, call send_otp api and load otp component.
        res.status(400).send({
          message: "Please verify with otp to update passwords",
          status: "1",
        });
      }
    })
    .catch((err) => {
      res.status(400).send({ message: "Something went wrong!!!" });
    });
}

router.get("/login", login);

function login(req, res) {
  req.body = req.query;
  User.findOne({
    email: req.body.email,
  })
    .then((user) => {
      if (!user || user.isVerified === false) {
        res.status(400).send({ message: "Invalid credentials" });
      } else {
        console.log("Error: ", user.internalAuth);
        if (
          bcrypt.compareSync(
            req.body.hashedPassword,
            user.internalAuth.hashedPassword
          )
        ) {
          // Passwords match
          const payload = {
            _id: user._id,
            email: user.email,
            firstname: user.firstname,
          };
          let token = jwt.sign(payload, process.SECRET_KEY, {
            algorithm: "HS256",
            expiresIn: 86400,
          });
          res.status(200).send(token);
        } else {
          // Passwords don't match
          res.status(400).send({ message: "Incorrect Password" });
        }
      }
    })
    .catch((err) => {
      console.log("Customer Login Error: ", err);
      res
        .status(400)
        .send({ messsage: "Something went wrong, please try again!!!" });
    });
}

router.post("/success", success);

function success(req, res) {
  transactions.success(req.body, (err, resData) => {
    if (err) {
      res.status(400).send({ message: err });
    } else {
      const response = JSON.parse(resData);
      // console.log("\n"+response+"\n");
      var date = new Date();
      date = date.toISOString();
      const newValues = {
        transactionId: response.TXNID,
        amount: response.TXNAMOUNT,
        updatedAt: date,
        referenceId: response.BANKTXNID,
        modeOfPayment: response.PAYMENTMODE,
        bankName: response.BANKNAME,
      };

      if (response.STATUS === "TXN_FAILURE") {
        newValues["status"] = "failed";
        Order.updateOne(
          { _id: response.ORDERID },
          newValues,
          (err, Success) => {
            if (err) {
              res.status(400).send({ message: "something went wrong!!!" });
            } else {
              res.status(400).send({ message: response.RESPMSG });
            }
          }
        );
      } else {
        newValues["status"] = "completed";
        Order.updateOne(
          { _id: response.ORDERID },
          newValues,
          (err, Success) => {
            if (err) {
              res.status(200).send({ message: "something went wrong!!!" });
            } else {
              res.status(200).send({ message: response.RESPMSG });
            }
          }
        );
      }
    }
  });
}

// send customer profile details
router.get("/profile", auth, get_profile);

function get_profile(req, res) {
  // console.log("Customer profile", req.user);
  User.findOne({
    _id: req.user._id,
  })
    .then((user) => {
      if (user) {
        res.send(user);
      } else {
        res.json({ error: "user does not exist" });
      }
    })
    .catch((err) => {
      res.json("error:" + err);
    });
}

// edit customer profile details
router.post("/edit_profile", edit_profile);

function edit_profile(req, res) {
  User.findOne({
    email: req.body.email,
  })
    .then((user) => {
      const userData = {
        $set: {
          firstName: req.body.firstname,
          lastName: req.body.lastname,
          phoneNum: req.body.phonenumber,
          isVeg: req.body.veg,
          Address: {
            Localty: req.body.localty,
            City: req.body.city,
            State: req.body.state,
            Pincode: req.body.pincode,
          },
        },
      };
      User.updateOne({ email: req.body.email }, userData, function (
        err,
        success
      ) {
        if (err) {
          res.status(400).send({
            message: "Something went wrong, please try again!!!",
          });
        } else {
          res.status(200).send("Details Updated");
        }
      });
    })
    .catch((err) => {
      res
        .status(400)
        .send({ message: "Something went wrong, please try again!!!" });
    });
}

// when customer likes an item
router.post("/item_liked", auth, like_item);

function like_item(req, res) {
  User.findByIdAndUpdate(
    { _id: req.user._id },
    {
      $push: {
        favChef: {
          chefId: req.body.chef_id,
        },
      },
    }
  );
}

//  contracts  //

// Add new contract
router.post("/add_contract", auth, (req, res) => {
  var userContract = new contract({
    deliveryDate: req.body.deliveryDate,
    contrTitle: req.body.contrTitle,
    contrType: req.body.contrType,
    contrDescription: req.body.contrDescription,
    contrStatus: 0,
  });
  User.findById(req.user._id, (err, userProfile) => {
    if (err) {
      console.log("Add Contract Error: user not found", err);
      res.status(400).send({ err: "User not found" });
    } else {
      userProfile.contracts.push(userContract);
      userProfile
        .save()
        .then((contractProfile) => {
          res.status(200).send({ msg: "Contract Added" });
        })
        .catch((err) => {
          res.status(400).send({ err: err });
          console.log("Add Contract Error: ", err);
        });
    }
  });
});

// get All Customer Contracts
router.get("/get_contracts", auth, (req, res) => {
  User.findById(req.user._id, (err, user) => {
    if (err) {
      console.log("Add Contract Error: user not found", err);
      res.status(400).send({ err: "User not found" });
    } else {
      res.status(200).send({ data: user.contracts });
    }
  });
});

// customer see his upcoming accepted contracts
router.get("/getApprovedContracts", (req, res) => {
  User.aggregate(
    [
      { $match: { _id: mongoose.Types.ObjectId(req.body.userId) } },
      { $unwind: "$contracts" },
      { $unwind: "$contracts.chefs" },
      {
        $match: {
          $and: [
            { "contracts.deliveryDate": { $gte: new Date.now() } },
            { "contracts.contrStatus": { $eq: 1 } },
            { "contracts.chefs.chefStatus": { $eq: 1 } },
          ],
        },
      },
    ],
    (err, getApprovedContracts) => {
      if (err) {
        res.send({ msg: err });
      } else {
        res.send({ msg: getApprovedContracts });
      }
    }
  );
});

//customer accept chefs intrest
router.post("/acceptChef", auth, (req, res) => {
  User.updateOne(
    { _id: mongoose.Types.ObjectId(req.user._id) },
    {
      $set: {
        "contracts.$[outter].chefs.$[inner].chefStatus": 1,
        "contracts.$[outter].contrStatus": 1,
      },
    },
    {
      arrayFilters: [
        { "outter._id": mongoose.Types.ObjectId(req.body.contractId) },
        { "inner.chefId": mongoose.Types.ObjectId(req.body.chefId) },
      ],
    },
    (err, acceptChef) => {
      if (err) {
        res.send({ msg: err });
      } else {
        res.send({ msg: acceptChef });
        //make all chefstatus to 2
      }
    }
  );
});

//customer reject chefs intrest
router.post("/rejectChef", (req, res) => {
  User.updateOne(
    { _id: mongoose.Types.ObjectId(req.body.userId) },
    {
      $set: {
        "contracts.$[outter].chefs.$[inner].chefStatus": 2,
        "contracts.$[outter].contrStatus": 0,
      },
    },
    {
      arrayFilters: [
        { "outter._id": mongoose.Types.ObjectId(req.body.contractId) },
        { "inner.chefId": mongoose.Types.ObjectId(req.body.chefId) },
      ],
    },
    (err, acceptChef) => {
      if (err) {
        res.send({ msg: err });
      } else {
        res.send({ msg: acceptChef });
      }
    }
  );
});

module.exports = router;
