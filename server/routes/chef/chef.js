const express = require("express");
const router = express.Router();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const auth = require("../middleware_jwt");
const speakeasy = require("speakeasy");
const mongoose = require("mongoose");

//File Upload
var multer = require("multer");
var path = require("path");
var upload = multer({ dest: "uploads/" });

//ElasticSearch
const elastic = require("../../routes/elasticSearchModule");

//MongoDB models
const { Chef } = require("../../models/chef.model");
const { User } = require("../../models/customer.model");
const { chefRequest } = require("../../models/customer.model");

const email = require("../send_email");

const googleMapsClient = require("@google/maps").createClient({
  key: "AIzaSyA7nx22ZmINYk9TGiXDEXGVxghC43Ox6qA",
  Promise: Promise,
});

router.use(cors());

process.SECRET_KEY = "hackit";
/////

router.post("/elasticsearch", create);

function create(req, res) {
  const indexName = "chefs";
  const Id = "6";
  var value = "far";
  const resName = "Near Restuarent 3";
  const resPlace = "Near Tadepalligudem";
  const resRating = 3.3;
  const resLat = 16.4801664;
  const resLon = 80.6110714;

  const lat = 16.4798428;
  const lng = 80.620487;

  const payload = {
    id: Id,
    name: resName,
    place: resPlace,
    rating: resRating,
    // suggest: {
    //   input: resName.split(" "),
    //   contexts: {
    //     location: {
    //       lat: resLat,
    //       lon: resLon
    //     }
    //   }
    // },
    pin: {
      location: {
        lat: resLat,
        lon: resLon,
      },
    },
  };

  value = value.toLowerCase();

  elastic.findDocs(indexName, "5eaaa97ea9425d5534803bd5", (err, response) => {
    if (err) {
      res.status(400).send({ message: err });
    } else {
      res.status(200).send({ message: response.body });
    }
  });
}

/////
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
    window: 1,
  });

  return tokenValidates;
}

router.post("/register", register);

function register(req, res) {
  Chef.findOne({
    email: req.body.email,
  })
    .then((chef) => {
      if (chef) {
        // In front-end check the status,
        // if status is '1' call send_otp api and load otp component,

        if (chef.isRegistered === false) {
          res
            .status(200)
            .send({ message: "Please verify your account!!!", status: "1" });
        } else {
          res.status(400).send({ message: "Account already exist" });
        }
      } else {
        bcrypt.hash(req.body.hashedPassword, 10, (err, hash) => {
          var secret = speakeasy.generateSecret({ length: 20 });

          const chefData = {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            phoneNum: req.body.phoneNumber,
            hashedPassword: hash,
            passwordResetToken: secret.base32,
            bio: req.body.bio,
            specialities: req.body.specialities,
          };

          Chef.create(chefData)
            .then((user) => {
              var token = gen_OTP(user.passwordResetToken);

              email.send_verification_token(token, user.email);

              res
                .status(200)
                .send({ message: "Please enter OTP!!!", status: "1" });
            })
            .catch((err) => {
              var arr = Object.keys(err["errors"]);
              var errors = [];
              for (i in arr) {
                errors.push(err["errors"][arr[i]].message);
              }
              res.status(400).send({ message: errors[0] });
            });
        });
      }
    })
    .catch((err) => {
      res
        .status(400)
        .send({ message: "Something went wrong, please try again!!!" });
    });
}

router.post("/verify_otp", verify);

function verify(req, res) {
  Chef.findOne({
    email: req.body.email,
  })
    .then((chef) => {
      if (!chef) {
        res
          .status(400)
          .send({ message: "account does not exist, please register!!!" });
      } else {
        var tokenValidates = verify_OTP(chef.passwordResetToken, req.body.OTP);

        if (!tokenValidates) {
          res.status(400).send({ message: "INVALID OTP!!!" });
        } else {
          if (chef.isRegistered === false) {
            const newValues = { $set: { isRegistered: true } };

            Chef.updateOne({ _id: chef._id }, newValues, function (
              err,
              success
            ) {
              if (err) {
                res.status(400).send({
                  message: "Something went wrong, please try again!!!",
                });
              } else {
                //indexing the user
                const payload = {
                  id: chef._id,
                  name: chef.firstName + " " + chef.lastName,
                  place: chef.Address.Localty,
                  rating: chef.rating,
                  pin: {
                    location: {
                      lat: 16.47749, //chef.location.coordinates
                      lon: 80.6055627, // chef.location.coordinates
                    },
                  },
                };
                elastic.indexing(
                  "chefs",
                  chef._id,
                  payload,
                  (err, response) => {
                    if (err) {
                      // res.status(400).send("error: not indexed")
                      console.log("\nerror: not indexed\n");
                    } else {
                      // res.status(200).send("Successfully registered your account!!!");
                      console.log(
                        "\nSuccessfully registered your account!!!\n"
                      );
                    }
                  }
                );
                res.status(200).send("Successfully registered your account!!!");
              }
            });
          } else {
            const newValues = { $set: { isValidated: true } };

            Chef.updateOne({ _id: chef._id }, newValues, function (
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
  var secret = speakeasy.generateSecret({ length: 20 });

  const newValues = { $set: { passwordResetToken: secret.base32 } };

  Chef.updateOne({ email: req.body.email }, newValues, function (err, success) {
    if (err) {
      res
        .status(400)
        .send({ message: "Something went wrong, please try again!!!" });
    } else {
      var token = gen_OTP(secret.base32);

      email.send_verification_token(token, req.body.email);

      res.status(200).send("OTP sent!!!");
    }
  });
}

router.post("/reset_password", reset);

function reset(req, res) {
  Chef.findOne({
    email: req.body.email,
  })
    .then((user) => {
      if (user.isValidated === true) {
        bcrypt.hash(req.body.newPassword, 10, (err, hash) => {
          if (err) {
            res
              .status(400)
              .send({ message: "Something went wrong, please try again!!!" });
          } else {
            const newValues = {
              $set: { hashedPassword: hash, isValidated: false },
            };

            Chef.updateOne({ email: req.body.email }, newValues, function (
              err,
              success
            ) {
              if (err) {
                res.status(400).send({
                  message: "Something went wrong, please try again!!!",
                });
              } else {
                res.status(200).send("Password updated!!!");
              }
            });
          }
        });
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
  Chef.findOne({
    email: req.body.email,
  })
    .then((user) => {
      if (!user || user.isRegistered === false) {
        res.status(400).send({ message: "Account does not exist" });
      } else {
        if (bcrypt.compareSync(req.body.hashedPassword, user.hashedPassword)) {
          // Passwords match
          const payload = {
            _id: user._id,
            email: user.email,
            fullname: user.firstName + " " + user.lastName,
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
      res
        .status(400)
        .send({ messsage: "Something went wrong, please try again!!!" });
    });
}
//  shiva   //
//remove
router.get("/usersList", function (req, res) {
  Chef.find({}, function (err, chefs) {
    console.log(Array.isArray(chefs));
    res.send({ chefs: chefs });
  });
});

router.get("/profile/:chefId", (req, res) => {
  Chef.aggregate(
    [
      { $match: { _id: mongoose.Types.ObjectId(req.params.chefId) } },
      {
        $project: {
          bio: 1,
          expertiseLevel: 1,
          status: 1,
          rating: 1,
          firstName: 1,
          lastName: 1,
          phoneNum: 1,
          email: 1,
          menu: {
            $filter: {
              input: "$menu",
              as: "item",
              cond: { $eq: ["$$item.forToday", 1] },
            },
          },
        },
      },
    ],
    (err, result) => {
      console.log(result);
      res.send({ stat: result });
    }
  );
});

//edit profile

router.post("/status/:chefId", (req, res) => {
  Chef.findById(req.params.chefId, (err, chefProfile) => {
    if (err) {
      console.log(err);
    } else {
      if (chefProfile.status === false) {
        //res.redirect('/chef/menu');
        res.redirect({ msg: "redirect to menu page" });
      } else {
        // change all forToday= 1 to fortoday = 0
        chefProfile
          .updateOne(
            { $set: { "menu.$[elem].forToday": 0, status: false } },
            {
              multi: true,
              arrayFilters: [{ "elem.forToday": 1 }],
            }
          )
          .then((status) => {
            res.send({ a: "u got it" });
          })
          .catch((err) => {
            console.log(err);
          });
      }
    }
  });
});

router.post("/todayMenu/:chefId", (req, res) => {
  Chef.findById(req.params.chefId, (err, chefProfile) => {
    if (err) {
      console.log(err);
    } else {
      var menu = chefProfile.menu.id(req.body.id);
      if (
        (menu.newDish === 0 && menu.validated === 0) ||
        (menu.newDish === 1 && menu.validated === 1)
      ) {
        if (menu.forToday == 0) {
          menu.forToday = 1;
          chefProfile.status = true;
        } else {
          menu.forToday = 0;
          //check for count of forToday if count =1 then status =0
          chefProfile.status = false;
        }

        chefProfile
          .save()
          .then((updatedMenu) => {
            res.send({ a: "chenged" });
            //res.redirect('/chef/menu');
          })
          .catch((err) => {
            console.log(err);
            res.send({ status: err });
          });
      } else {
        res.send({ a: "you need to validate your dish by popular chef" });
      }
    }
  });
});

router.get("/menu", (req, res) => {
  Chef.findById("5e62590aec3e2918d40f9886", (err, chefProfile) => {
    if (err) {
      console.log("no chef");
    } else {
      console.log(chefProfile);

      //res.render('chef', {chefId: chefProfile.id,chefMenu: chefProfile.menu})  //id
      res.send({ chefId: chefProfile.id, chefMenu: chefProfile.menu });
    }
  });
});

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + "-" + Date.now() + ".jpg");
  },
});

var upload = multer({ storage: storage }).single("dishPic");

router.post("/menu", upload, function (req, res) {
  Chef.findById("5e62590aec3e2918d40f9886", (err, chefProfile) => {
    if (err) {
      console.log("err: " + err);
      // redirect to profile
    } else {
      console.log(req.body.itemCost);

      var menuUpload = new Menu({
        itemName: req.body.itemName,
        itemDescr: req.body.itemDescr,
        itemRecpie: req.body.itemRecpie,
        itemCost: req.body.itemCost,
        isVeg: req.body.isVeg,
        dishPic: "uploads/" + req.file.filename,
        forToday: 0,
        newDish: req.body.newDish,
      });

      chefProfile.menu.push(menuUpload);

      chefProfile
        .save()
        .then((updatedProfile) => {
          res.redirect("/chef/menu");
        })
        .catch((err) => {
          res.send({ status: err });
          // redirect to
          // res.redirect('');
        });
    }
  });
});

router.get("/menu/edit/:chefId", (req, res) => {
  Chef.findById(req.params.chefId, (err, chefProfile) => {
    if (err) {
      console.log(err);
      // res.redirect('chef/menu');
    } else {
      try {
        var menu = chefProfile.menu.id(req.query.dishId);
        res.send({ Menu: menu });
      } catch (e) {
        console.log(e);
        // redirect to
        // res.redirect('chef/menu');
      }
    }
  });
});

router.post("/menu/edit/:chefId", (req, res) => {
  Chef.findById(req.params.chefId, (err, chefProfile) => {
    if (err) {
      console.log(err);
      // redirect to
      // res.redirect('');
    } else {
      var menuToUpadate = chefProfile.menu.id(req.body.id);
      console.log("test: " + menuToUpadate);
      menuToUpadate.itemName = req.body.itemName;
      menuToUpadate.itemDescr = req.body.itemDescr;
      menuToUpadate.itemRecpie = req.body.itemRecpie;
      menuToUpadate.itemCost = req.body.itemCost;
      menuToUpadate.dishPic = req.body.dishPic;
      menuToUpadate.isVeg = req.body.isVeg;
      menuToUpadate.newDish = req.body.newDish;

      chefProfile
        .save()
        .then((updatedMenu) => {
          res.send({ status: "done" });
          //res.redirect('/chef');
        })
        .catch((err) => {
          console.log(err);
          res.send({ status: err });
        });
      //res.send({stat: "done"});
    }
  });
});

router.post("/menu/delete/:chefId", (req, res) => {
  Chef.findById(req.params.chefId, (err, chefProfile) => {
    if (err) {
      console.log(err);
    } else {
      var getMenu = chefProfile.menu.id(req.body.dishId);
      if (getMenu.forToday === 0) {
        chefProfile.menu.pull(req.body.dishId);

        chefProfile
          .save()
          .then((updatedProfile) => {
            res.send({ msg: "deleted" }); //redirct
          })
          .catch((err) => {
            console.log(err);
            res.send({ status: err });
          });
      } else {
        res.send({ stat: "cant delete this dish as this is for todays dish" });
      }
    }
  });
});

async function getRequestDetails(chefid, dishid) {
  var requestDetails = await Chef.aggregate([
    { $match: { _id: mongoose.Types.ObjectId(chefid) } },
    { $unwind: "$menu" },
    {
      $match: {
        $and: [
          { _id: mongoose.Types.ObjectId(chefid) },
          { "menu._id": mongoose.Types.ObjectId(dishid) },
        ],
      },
    },
  ]);
  return {
    chefId: requestDetails[0]._id,
    chefDish: requestDetails[0].menu,
  };
}

async function requestDetails(requests, res) {
  let dishes = [];
  for (var i = 0; i < requests[0].requests.length; i++) {
    dishes.push(
      await getRequestDetails(
        requests[0].requests[i].chefId,
        requests[0].requests[i].dishId
      )
    );
    console.log(dishes);
  }
  Promise.all(dishes)
    .then((result) => {
      res.send({ stat: result });
    })
    .catch((err) => {
      console.log(err);
    });
}

router.post("/requests", (req, res) => {
  Chef.aggregate(
    [
      { $match: { _id: mongoose.Types.ObjectId(req.body.chefId) } },
      {
        $project: {
          requests: {
            $filter: {
              input: "$dishValidationRequests",
              as: "request",
              cond: { $eq: ["$$request.reply", 0] },
            },
          },
        },
      },
    ],
    (err, requests) => {
      if (err) {
        console.log(err);
      } else {
        requestDetails(requests, res);
      }
    }
  );
});

router.post("/request/response/:Id", (req, res) => {
  var dishReport = new DishReport({
    chefId: req.params.Id, // request accepting chef
    rating: req.body.rating,
    remarks: req.body.remarks,
    response: req.body.response,
  });
  // required chefId, dishId
  Chef.findById(req.body.chefId, (err, chefProfile) => {
    if (err) {
      console.log(err);
    } else {
      var dish = chefProfile.menu.id(req.body.dishId);
      // push dish report
      dish.dishReport.push(dishReport);

      chefProfile
        .save()
        .then((updatedDishReport) => {
          // update request reply = 1
          Chef.updateOne(
            { _id: req.params.Id },
            { $set: { "dishValidationRequests.$[elem].reply": 1 } },
            {
              multi: true,
              arrayFilters: [{ "elem.dishId": { $eq: req.body.dishId } }],
            }
          )
            .then((updatedRequest) => {
              //push notification
              report = updatedDishReport.menu.id(req.body.dishId).dishReport;

              if (report.length === 5) {
                //count response from dish report
                var response_count = 0;
                report.forEach((responseReport) => {
                  response_count = response_count + responseReport.response;
                });

                if (response_count > 2) {
                  // update req_status = 1;
                  //update menu validated = 1;
                  // push notification: dish accepted
                  console.log(req.body.chefId);
                  console.log(req.body.dishId);
                  Chef.updateOne(
                    { _id: req.body.chefId },
                    {
                      $set: {
                        "menu.$[elem].validated": 1,
                        "menu.$[elem].request_status": "Dish validated",
                      },
                    },
                    {
                      multi: true,
                      arrayFilters: [{ "elem._id": { $eq: req.body.dishId } }],
                    }
                  )
                    .then((status) => {
                      //check modified ok: 1
                      //redirect to request page
                      console.log(status);

                      res.send({ stat: "dish validated" });
                    })
                    .catch((err) => {
                      console.log(err);
                    });
                } else {
                  // update req_status = 1;
                  //update menu validated = 2;
                  // push notification: dish rejected
                  Chef.updateOne(
                    { _id: req.body.chefId },
                    {
                      $set: {
                        "menu.$[elem].validated": 0,
                        "menu.$[elem].request_status": "Dish validated",
                      },
                    },
                    {
                      multi: true,
                      arrayFilters: [{ "elem.id": { $eq: req.body.dishId } }],
                    }
                  )
                    .then((status) => {
                      //check modified ok: 1
                      //redirect to request page
                      res.send({ stat: "dish not validated" });
                    })
                    .catch((err) => {
                      console.log(err);
                    });
                }
              } else {
                //redirect to request page
                res.send({ a: "not all responded" });
              }
            })
            .catch((err) => {
              console.log(err);
            });
        })
        .catch((err) => {
          console.log(err);
        });
    }
  });
});

router.post("/getChefs", gmap);

async function gmap(req, res) {
  const lat = req.body.lat;
  const lng = req.body.lng;

  // await  Chef.find({})
  // .then(u => {
  //  chefsLocations = u
  // })

  var chefsLocations = [
    {
      place: "hyderabad",
      lat: 17.385044,
      lng: 78.486671,
    },
    {
      place: "kurnool",
      lat: 15.828126,
      lng: 78.037277,
    },
    {
      place: "gadwal",
      lat: 16.235001,
      lng: 77.799698,
    },
    {
      place: "warangal",
      lat: 17.971759,
      lng: 79.608924,
    },
    {
      place: "vijayawada",
      lat: 16.499847,
      lng: 80.656016,
    },
  ];

  list = []; // list to store all chef's data and distances

  for (let i = 0; i < chefsLocations.length; i++) {
    dest = chefsLocations[i].lat + "," + chefsLocations[i].lng;

    await googleMapsClient
      .directions({
        origin: lat + "," + lng,
        destination: dest,
        units: "metric",
      })
      .asPromise()
      .then((response) => {
        // print response for more clarity

        var value = chefsLocations[i];
        distance = response.json.routes[0].legs[0].distance.text; // getting dist string in km from response
        distArray = distance.split(" "); // spliting the string like "283 km" by space to get distArray= ["283", "km"]
        value["distance"] = parseFloat(distArray[0]); // changing data type to float from string
        list.push(value);
      })
      .catch((err) => {
        console.log(err);
      });
  }

  list.sort((a, b) => (a.distance > b.distance ? 1 : -1)); // sorting list according to dist
  res.send(list);
}

router.get("/profile", auth, get_profile);

function get_profile(req, res) {
  Chef.findOne({
    _id: req.user._id,
  })
    .then((user) => {
      if (user) {
        res.send(user);
      } else {
        res.json({ error: "chef does not exsist " });
      }
    })
    .catch((err) => {
      res.json("error: " + err);
    });
}

// get chef's  details for contract status page on user's side
router.post("/get_details", get_details);

function get_details(req, res) {
  console.log("sdsadsa, ", req.body);
  Chef.findOne({
    _id: req.body.id,
  })
    .then((user) => {
      if (user) {
        res.status(200).send(user);
      } else {
        res.json({ error: "chef does not exsist " });
      }
    })
    .catch((err) => {
      res.json("error: " + err);
    });
}

// validate chef function
router.get("/validate", auth, validate_chef);

function validate_chef(req, res) {
  // needs working
  Chef.findByIdAndUpdate(
    { _id: req.user._id },
    { $set: { expertiseLevel: true } }
  )
    .then(() => {
      res.status(200).send({ info: "chef validated" });
    })
    .catch((err) => {
      console.log("chef validation error: ", err);
      res.status(400).send(err);
    });
}

// router.post("/edit_profile", edit_profile);

router.post("/update_status", status_update);

function status_update(req, res) {
  const status = {
    $set: {
      workingStatus: req.body.status,
    },
  };
  Chef.updateOne({ email: req.body.email }, status)
    .then((resp) => {
      // update index
      Chef.aggregate(
        [
          { $match: { email: req.body.email } },
          {
            $project: {
              workingStatus: 1,
            },
          },
        ],
        (err1, resp) => {
          if (err1) {
            res
              .status(400)
              .send({ message: "Something went wrong, please try again!!!" });
          } else {
            // update indexed docs
            elastic.updateStatus(
              "chefs",
              resp[0]._id,
              resp[0].workingStatus,
              (err, response) => {
                if (err) {
                  console.log("\nnot indexed\n");
                } else {
                  console.log("\nUpdated doc in index\n");
                }
              }
            );
          }
        }
      ),
        res.status(200).send({ message: "Status Updated" });
    })
    .catch((err) => {
      res
        .status(400)
        .send({ message: "Something went wrong, please try again!!!" });
    });
}

var storage = multer.diskStorage({
  destination: "public/img/",
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

var upload = multer({ storage: storage }).single("dishPic");
// Adds new item to menu
router.post("/add_item", auth, upload, add_item);

function add_item(req, res) {
  Chef.findByIdAndUpdate(
    { _id: req.user._id },
    {
      $push: {
        menu: {
          itemName: req.body.itemName,
          itemDescr: req.body.itemDescr,
          itemCost: req.body.itemCost,
          isVeg: req.body.isVeg,
          dishPic: req.file.filename,
        },
      },
    },
    { new: true },
    (err, chefDocs) => {
      if (err) {
        res.status(400).send({ message: "Item not added" });
        console.log("Item not added: ", err);
      } else {
        chefDocs.menu.forEach((dish) => {
          if (dish.itemName === req.body.itemName) {
            console.log("-----: ", dish);

            // indexing
            const payload = {
              chefId: req.user._id,
              chefName: req.user.fullname,
              dishId: dish._id,
              dishName: dish.itemName,
              dishPic: dish.dishPic,
              pin: {
                location: {
                  lat: 16.47749, //chef.location.coordinates
                  lon: 80.6055627, // chef.location.coordinates
                },
              },
            };
            elastic.indexing("menu", dish._id, payload, (err, resp) => {
              if (err) {
                // res.status(400).send("error: not indexed")
                console.log("\nerror: not indexed\n");
              } else {
                // res.status(200).send("Item added");
                console.log("\nItem indexed\n");
              }
            });
            res.status(200).send({ message: "Item added" });
          }
        });
      }
    }
  );
}

router.post("/delete_item", auth, delete_item);

function delete_item(req, res) {
  elastic.deleteDocs("menu", "5eaab9a0c00181206c1e7c4e", (err, response) => {
    if (err) {
      res.status(400).send("error: Item not removed");
    } else {
      Chef.updateOne(
        { _id: req.user._id },
        {
          $pull: {
            menu: {
              itemName: req.body.itemName,
            },
          },
        }
      )
        .then((resp) => {
          res.status(200).send({ message: "Item Removed" });
        })
        .catch((err) => {
          res.status(400).send({ message: "Item not removed" });
        });
    }
  });
}

router.post("/delete_item", auth, delete_item);

function delete_item(req, res) {
  Chef.updateOne(
    { _id: req.user._id },
    {
      $pull: {
        menu: {
          itemName: req.body.itemName,
        },
      },
    }
  )
    .then(res.status(200).send("Item Removed"))
    .catch(res.status(400).send("error: Item not removed"));
}

router.get("/avail_items", avail_items);

function avail_items(req, res) {
  Chef.find(
    { workingStatus: true },
    { firstName: 1, lastName: 1, menu: 1 }
  ).then((items) => {
    if (items) {
      res.send(items);
    } else {
      res.json({ error: "no chefs are cooking right now" });
    }
  });
}

//  contracts   //
//get active contracts and which are not rejected by chefs  //check
router.get("/contracts", (req, res) => {
  var d = new Date();
  var n = d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();

  User.aggregate(
    [
      {
        $project: {
          contracts: {
            $filter: {
              input: "$contracts",
              as: "contract",
              cond: {
                $and: [
                  { $gte: ["$$contract.deliveryDate", new Date(String(n))] },
                  { $eq: ["$$contract.contrStatus", 0] },
                ],
              },
            },
          },
        },
      },
    ],
    (err, activeContracts) => {
      if (err) {
        res.send({ msg: err });
      } else {
        res.send({ list: activeContracts });
      }
    }
  );
});

//chefs accept an active contracts
router.post("/contract/accept", auth, (req, res) => {
  User.findById(req.body.userId, (err, profile) => {
    //req.body.userId
    if (err) {
      res.send({ msg: err });
    } else {
      var getContract = profile.contracts.id(req.body.contractId);
      var chefResponse = new chefRequest({
        chefId: req.user._id,
        roomId: req.body.contractId + req.user._id,
      });
      getContract.chefs.push(chefResponse);
      profile
        .save()
        .then(() => {
          res.status(200).send({ msg: profile });
        })
        .catch((err) => res.status(400).send({ msg: err }));
    }
  });
});

//chefs reject an active contracts
router.post("/contract/reject", (req, res) => {
  User.findById(req.body.userId, (err, profile) => {
    if (err) {
      res.send({ msg: err });
    } else {
      var getContract = profile.contracts.id(req.body.contractId);
      var chefResponse = new chefRequest({
        chefId: req.body.chefId,
        chefStatus: 2,
      });
      getContract.chefs.push(chefResponse);
      profile
        .save()
        .then(() => {
          res.send({ msg: profile });
        })
        .catch((err) => res.send({ msg: err }));
    }
  });
});

//upcomming approved contracts
router.post("/upcomingContracts", auth, (req, res) => {
  var d = new Date();
  var n = d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
  User.aggregate(
    [
      { $unwind: "$contracts" },
      { $unwind: "$contracts.chefs" },
      {
        $match: {
          $and: [
            { "contracts.deliveryDate": { $gte: new Date(String(n)) } },
            { "contracts.contrStatus": { $eq: 1 } },
            { "contracts.chefs.chefId": { $eq: req.user._id } },
            { "contracts.chefs.chefStatus": { $eq: 1 } },
          ],
        },
      },
    ],
    (err, upcommingAcceptedContracts) => {
      if (err) {
        res.send({ msg: err });
      } else {
        res.send({ msg: upcommingAcceptedContracts });
      }
    }
  );
});

//get his prev contracts
router.post("/prevContracts", auth, (req, res) => {
  var d = new Date();
  var n = d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
  User.aggregate(
    [
      { $unwind: "$contracts" },
      { $unwind: "$contracts.chefs" },
      {
        $match: {
          $and: [
            { "contracts.deliveryDate": { $lt: new Date(String(n)) } },
            { "contracts.contrStatus": { $eq: 1 } },
            { "contracts.chefs.chefId": { $eq: req.body.chefId } },
            { "contracts.chefs.chefStatus": { $eq: 1 } },
          ],
        },
      },
    ],
    (err, prevContracts) => {
      if (err) {
        res.send({ msg: err });
      } else {
        res.send({ msg: prevContracts });
      }
    }
  );
});

module.exports = router;
