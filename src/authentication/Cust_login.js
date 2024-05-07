import React, { Component, Fragment } from "react";
import { Link, Redirect } from "react-router-dom";
import Modal from "react-responsive-modal";
import "./Cust_login.css";
import axios from "axios";
import Cookies from "js-cookie";
import change_bg from "../index";

export default class Cust_login extends Component {
  constructor() {
    super();
    this.state = {
      email: "",
      hashedPassword: "",
      authenticated: false,
      errorFlag: false,
      errMsg: "",
      pswdResetFlag: false,
      otp: "",
      otpVerified: false,
      disableOTPFlag: true,
      resetPasswordFlag: false,
      newPassword: "",
      newPasswordCnf: "",
      resetPswdSuccess: "",
    };
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.requestOTP = this.requestOTP.bind(this);
    this.verifyOTP = this.verifyOTP.bind(this);
    this.resetPassword = this.resetPassword.bind(this);
  }
  handleChange(event) {
    this.setState({ [event.target.name]: event.target.value });
  }
  handleSubmit(event) {
    const userData = {
      email: this.state.email,
      hashedPassword: this.state.hashedPassword,
    };
    console.log(userData);
    axios
      .get("/customer/login", { params: userData })
      .then((res) => {
        console.log(res.data);
        Cookies.set("usertoken", res.data);
        this.setState({ authenticated: true });
        // this.props.history.push('/')
      })
      .catch((err) => {
        console.log(err.response.data.message);
        this.setState({
          errorFlag: true,
          errMsg: String(err.response.data.message),
        });
      });

    event.preventDefault();
  }
  requestOTP() {
    console.log("send otp api called!!!")
    axios
      .post("/customer/send_otp", { email: this.state.email })
      .then((res) => {
        // load otp component
        this.setState({ disableOTPFlag: false });
        console.log(res.data);
      })
      .catch((err) => {
        this.setState({
          errorFlag: true,
          errMsg: String(err.response.data.message),
        });
        // console.log(err.response.data.message);
      });
  }

  verifyOTP() {
    axios
      .post("/customer/verify_reset_password_otp", {
        email: this.state.email,
        OTP: this.state.otp,
      })
      .then((res) => {
        this.setState({ resetPasswordFlag: true });
        console.log(res.data);
      })
      .catch((err) => {
        this.setState({
          errorFlag: true,
          errMsg: String(err.response.data.message),
        });
      });
  }
  resetPassword() {
    if (this.state.newPassword === this.state.newPasswordCnf) {
      axios
        .post("/customer/reset_password", {
          email: this.state.email,
          newPassword: this.state.newPassword,
        })
        .then((res) => {
          console.log(res.data);
          this.setState({ resetPswdSuccess: "Password Reset Successful!!" });
        })
        .catch((err) => {
          // ask user for resending otp....
          this.setState({
            errorFlag: true,
            errMsg: String(err.response.data.message),
          });
          console.log(err.response.data.message);
        });
    } else {
      this.setState({
        errorFlag: true,
        errMsg: "Password and Confirm Password Fields do not Match",
      });
    }
  }

  render() {
    if (this.state.authenticated) {
      return <Redirect to="/Home" />;
    }
    return (
      <Fragment>
        <Modal
          open={this.state.errorFlag}
          onClose={() => this.setState({ errorFlag: false })}
          closeOnOverlayClick={true}
        >
          <div className="container" style={{ width: "35vw", padding: "5%" }}>
            <div className="card text-center border-danger">
              <div
                className="card-header"
                style={{ backgroundColor: "#dc3545", color: "white" }}
              >
                Error
              </div>
              <div className="card-body">{this.state.errMsg}</div>
            </div>
          </div>
        </Modal>
        <div
          className="row"
          style={{ height: "100vh" }}
          onLoad={change_bg("cust_lg")}
        >
          {this.state.pswdResetFlag ? (
            <div className="col-6" style={{ padding: "4%", marginTop: "90px" }}>
              <h3 className="signin">Reset Password</h3>
              <br />
              {this.state.resetPasswordFlag ? (
                <div style={{ color: "#757575" }}>
                  <p>Enter New password</p>
                  <div className="md-form">
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Password"
                      name="newPassword"
                      value={this.state.newPassword}
                      onChange={this.handleChange}
                      required
                    />
                  </div>
                  <br />
                  <div className="md-form">
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Confirm Password"
                      name="newPasswordCnf"
                      value={this.state.newPasswordCnf}
                      onChange={this.handleChange}
                      required
                    />
                  </div>
                  <button
                    className="btn btn-outline-dark btn-rounded btn-block my-4 waves-effect z-depth-0"
                    onClick={this.resetPassword}
                  >
                    Change Password
                  </button>

                  <span className="text-success">
                    {this.state.resetPswdSuccess}
                  </span>
                  <br />
                  <span>
                    Back to{" "}
                    <button
                      className="btn btn-outline-dark"
                      onClick={() => {
                        this.setState({ pswdResetFlag: false });
                      }}
                    >
                      Login
                    </button>
                  </span>
                </div>
              ) : (
                <div style={{ color: "#757575" }}>
                  <p>
                    We'll send an OTP to your registered email-id to recover
                    your account
                  </p>
                  <div className="input-group mb-3">
                    <input
                      type="text"
                      className="form-control"
                      name="email"
                      placeholder="Enter your Email id"
                      value={this.state.email}
                      onChange={this.handleChange}
                    />
                    <div className="input-group-append">
                      <button
                        className="btn btn-outline-dark"
                        type="button"
                        onClick={this.requestOTP}
                      >
                        Send OTP
                      </button>
                    </div>
                  </div>
                  <br />
                  <div className="md-form">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter OTP"
                      name="otp"
                      value={this.state.otp}
                      onChange={this.handleChange}
                      disabled={this.state.disableOTPFlag}
                      required
                    />
                  </div>
                  <button
                    className="btn btn-outline-dark btn-rounded btn-block my-4 waves-effect z-depth-0"
                    onClick={this.verifyOTP}
                  >
                    Verify
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="col-6" style={{ padding: "4%", marginTop: "90px" }}>
              <Link to="/">&lt;&lt;&nbsp;Back to Front Page</Link>
              <h3 className="signin">Sign In</h3>
              <br />
              <form
                onSubmit={this.handleSubmit}
                className="text-center"
                method="Post"
                style={{ color: "#757575" }}
              >
                <div className="md-form">
                  <input
                    type="text"
                    id="materialLoginFormEmail"
                    className="form-control"
                    name="email"
                    placeholder="Email id"
                    value={this.state.email}
                    onChange={this.handleChange}
                    required
                  />
                </div>
                <br />
                <div className="md-form">
                  <input
                    type="password"
                    id="materialLoginFormPassword"
                    className="form-control"
                    placeholder="Password"
                    name="hashedPassword"
                    value={this.state.hashedPassword}
                    onChange={this.handleChange}
                    required
                  />
                </div>
                <button
                  className="btn btn-outline-dark btn-rounded btn-block my-4 waves-effect z-depth-0"
                  type="submit"
                >
                  Login
                </button>
                <p>
                  <button
                    className="btn btn-sm btn-info"
                    onClick={() => {
                      this.setState({ pswdResetFlag: true });
                    }}
                  >
                    Forgot Password?
                  </button>
                  <br />
                  Don't have an account?&nbsp;
                  <Link to="/Register">Register</Link>
                </p>
              </form>
              <hr />
              <center>
                <a href= "http://localhost:8008/customer/auth/google"><button
                  className="btn btn-outline-dark btn-rounded my-4 waves-effect z-depth-0"
                  type="submit"
                >
                  <i className="fab fa-google"></i>&nbsp;&nbsp;Sign in
                </button></a>
              </center>
            </div>
          )}
          <div className="col-6" />
        </div>
      </Fragment>
    );
  }
}
