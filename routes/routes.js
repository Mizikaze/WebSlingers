let express = require('express');
let router = express.Router();
let bodyParser = require('body-parser');

router.use(bodyParser.urlencoded({ extended: true }));
let db = require('../DBfunctions');

let searchTest = require('./search');                   // Test for search function, do not remove!
let matchingStudent = require('./match');
let matchingCompany = require('./companyMatch');


let bcrypt = require('bcrypt');
let mysql = require('mysql');
let fs = require("fs");

const nodemailer = require('nodemailer');

var sort_test;

var con = mysql.createConnection({
    host: "83.255.197.121",
    user: "joakim",
    password: "joakim97",
    port: "3306",
    database: "webslingers"
});

router.get('/', (req, res) => {
    if (req.session.user) {
        db.getuname(req.session.user, function (err, result) {
            if (err) throw err;
            res.redirect('/profile');
        });
    }
    else
        res.render('index');
});
router.post('/register', (req, res) => {
    var username = req.body.username,
        password = req.body.password,
        role = req.body.role,
        pnum = req.body.pnum;

    bcrypt.hash(req.body.password, 10, function (err, hash) {
        if (err) throw err;

        db.insert_user(username, hash, role, function (err, result) {
            if (err) {
                req.flash('danger', 'User already exists. Please choose another username and try again.')
                res.redirect('/');
            }
            else if (role === "student" && !err) {
                console.log('db.insert_student')
                db.insert_student(username, pnum, function (err, result) {
                    if (err) throw err;
                    req.flash('success', 'You have successfully registered your account.');
                    res.redirect('/');
                })
            }
            else if (role === "company" && !err) {
                console.log('db.insert_company')
                db.insert_company(username, pnum, function (err, result) {
                    if (err) throw err;
                    req.flash('success', 'You have successfully registered your account.');
                    res.redirect('/');
                })
            }
        })
    })
});

router.get('/login', function (req, res) {
    if (req.session.user) {
        db.getuname(req.session.user, function (err, result) {
            if (err) throw err;
            res.redirect('/profile');
        });
    }
    else
        res.render('index')
});
router.post('/login', function (req, res) {
    var username = req.body.username,
        password = req.body.password;
    var sql = "SELECT * FROM users WHERE ID = ?";
    con.query(sql, username, function (err, results) {
        if (err) throw err;
        if (results.length == 0) {
            req.flash('danger', 'Invalid username or password');
            res.redirect('/');
        }
        else {
            bcrypt.compare(password, results[0].Password, function (err, match) {
                if (match) {
                    if (req.body.remember) {
                        req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 365 * 100;
                    }
                    else {
                        req.session.cookie.expires = null;
                    }
                    req.session.user = username;
                    req.session.role = results[0].Role;
                    req.flash('success', 'You have successfully logged in');
                    res.redirect('/profile');
                    if(req.session.role === 'student')
                        matchingStudent.prematching(req.session.user);
                    else if(req.session.role === 'company')
                        matchingCompany.companyPrematching(req.session.user);
                }
                else {
                    req.flash('danger', 'Invalid username or password');
                    res.redirect('/');
                }
            });
        }
    });
});
router.get('/profile', (req, res) => {
    if (req.session.user && req.session.role == 'student') {
        db.get_student_user_and_nr(req.session.user, function (err, result) {
            if (err) throw err;
            req.session.pnr = result[0].pnr;
            req.session.student = result;
        });
        db.get_student_qualifications(req.session.user, function (err, results) {
            if (err) throw err;
            req.session.get_student_qual = results
        });
        db.get_workexp(req.session.user, function (err, results) {
            if (err) throw err;
            req.session.get_workexp = results;
        })
        db.get_education(req.session.user, function(err, results){
            if (err) throw err;
            req.session.get_education = results
        })
        db.get_qualifications(function (err, results) {
            if (err) {
            }
            req.session.qual_list = results;
            res.render('StudentProfile', {
                results: results,
                student_user_and_nr: req.session.student,
                get_student_qual: req.session.get_student_qual,
                get_workexp: req.session.get_workexp,
                get_education: req.session.get_education
            });
        })
    }
    else if (req.session.user && req.session.role == 'company') {
        db.get_company_user_and_nr(req.session.user, function (err, result) {
            if (err) throw err
            else {
                req.session.orgnr = result[0].Orgnr;
                req.session.company = result;
            }
        });
        db.get_qualifications(function (err, results) {
            if (err) {
            }
            req.session.qual_list = results;
        });
        db.get_exjobs(req.session.user, function (err, results) {
            if (err) throw err
            else {
                req.session.getData = results;
                req.session.exid = results;

            }
        });
        db.get_demanded_qual(req.body.job_id, function (err, results) {
            if (err) {
            }
            req.session.quals = results;
            res.render('companyProfile', {
                get_exjobs: req.session.exid,
                exjobs: req.session.getData,
                get_company_user_and_nr: req.session.company,
                qual_list: req.session.qual_list,
                quals: req.session.quals
            })
        });
    }
    else{
        req.flash('danger', 'Logga in innan du går vidare')
        res.redirect('/')
    }

});
router.get('/logout', (req, res) => {
    console.log("qual_list: ", req.session.qual_list);
    req.session.destroy();
    res.redirect('/');
});

router.post('/change_student_profile', function (req, res) {
    var uname = req.body.username,
        name = req.body.name,
        pnr = req.body.pnum,
        gender = req.body.gender,
        tel = req.body.tel,
        adress = req.body.address;

    bcrypt.hash(req.body.password, 10, function (err, hash) {
        if (err) throw err;
        db.update_user(req.session.user, hash, function (err, result) {
            if (err) {
                req.flash('danger', 'An error has occured while updating');
                res.redirect('/profile');
            }
            else if (!err) {
                db.update_studentprofile(req.session.pnr, req.session.user, name, gender, adress, tel, function (err, result) {
                    if (err) {
                        req.flash('danger', 'An error has occured while updating');
                        res.redirect('/profile');
                    }
                    else {
                        req.flash('success', 'You have succcessfully updated your profile');
                        res.redirect('/profile');
                    }
                })
            }
        })
    })
});

router.post('/change_company_profile', function (req, res) {
    var uname = req.body.username,
        password = req.body.password,
        name = req.body.name,
        pnr = req.body.pnum,
        gender = req.body.gender,
        tel = req.body.tel,
        adress = req.body.address;
    bcrypt.hash(req.body.password, 10, function (err, hash) {
        if (err) throw err;
        db.update_company(req.session.user, hash, function (err, result) {
            if (err) {
                req.flash('danger', 'An error has occured while updating');
                res.redirect('/profile');
            }
            else if (!err) {
                db.update_companyprofile(req.session.orgnr, req.session.user, name, adress, tel, function (err, result) {
                    if (err) {
                        req.flash('danger', 'An error has occured while updating');
                        res.redirect('/profile');
                    }
                    else {
                        req.flash('success', 'You have succcessfully updated your profile');
                        res.redirect('/profile');
                    }
                })
            }
        })
    })
});

// filhantering cv
router.post('/filetest', function (req, res) {

    if (req.files) {
        console.log(req.files);
        console.log(req.files.filename.data);
        //var file = req.files.filename,
        //    filename = file.name;
        //    console.log("filnamnet: "+ filename);
        //file.mv("../public/upload/"+filename, function(err){
        //    if(err){
        //        console.log('error occured'+err);
        //        req.flash('danger', 'error occured');
        //    }
        //    else{
        //        req.flash('success', 'Done!');
        //        res.redirect("/profile");
        //    }
        //})
        db.update_user_cv(req.session.pnr, req.files.filename.data, function (err, result) {
            if (err) {
                req.flash('danger', 'An error has occured while updating');
                res.redirect('/profile');
            }
            else if (!err) {
                req.flash('success', 'You have succcessfully updated your profile');
                res.redirect('/profile');
            }
        })
    }
});
// skriva ut cv på sidan
router.get('/Certificate', function (req, res) {
    db.get_cv(req.session.pnr, function (err, result) {
        if (err) {
            req.flash('danger', 'An error has occured while loading');
            res.redirect('/profile');
        }
        else if (!err) {
            console.log("result: ", result)
            res.render('Certificate', {
                results: result
            });
        }
    })
})

router.post('/hejhopmanstest', function (req, res) {            // Needs to find an other solution!!!!
    db.get_student_user_and_nr(req.session.user, function (err, result) {
        if (err) throw err;
        res.render('StudentProfile', {
            student_user_and_nr: result,
            matchning: matchingStudent.matcha()
        });
    });

});

router.post('/companyMatchTest', function (req, res) {            // Needs to find an other solution!!!!
    db.get_student_user_and_nr(req.session.user, function (err, result) {
        if (err) throw err;
        res.render('companyProfile', {
            results: result,
            matchning: matchingCompany.companyMatcha()
        });
    });
});

router.get('/search', function (req, res) {                     // For testing, do not remove!!!!!!
    //searchTest.testmatch();
});

router.get('/dbtester', function (req, res) {
    db.get_students(function (err, result) {
        if (err) throw err;
        req.session.res = result;
        console.log("dbtest: " + req.session.res[0].UID);
        console.log("hejhej:", req.session.qual_list);
    })
});

router.post('/add_job', function (req, res) {
    console.log(req.body.title);
    console.log(req.body.info);
    console.log(req.session.orgnr);
    console.log(req.body.date);

    db.insert_exjobs(req.session.orgnr, req.body.title, req.body.info, req.body.date, req.body.teaser, function (err, results) {
        if (err) {
            req.flash('danger', 'Ett fel har uppstått');
            res.redirect('/profile');
        }
        else {
            req.flash('success', 'Du har lagt till ett nytt jobb');
            res.redirect('/profile');
        }
    })
});
router.post('/update_job', function (req, res) {
    db.update_exjob(req.body.name, req.body.info, req.body.date, req.body.teaser, req.body.job_id, function (err, result) {
        if (err) {
            req.flash('danger', 'An error has occured while updating your profile');
            res.redirect('/profile');
        }
        else {
            req.flash('success', 'You have successfully updated a job');
            res.redirect('/profile');
        }
    })
});
router.post('/delete_job', function (req, res) {
    db.delete_exjob(req.body.job_id, function (err, results) {
        if (err) {
            req.flash('danger', 'An error has occured');
            res.redirect('/profile');
        }
        else {
            req.flash('success', 'You have successfully removed a job')
            res.redirect('/profile');
        }
    })
});
router.get('/profileStudentProfile', function (req, res) {
    res.render("pages/profileStudentProfile");
});
router.post('/testmatch', function(req,res){
    req.body.job_id 
    res.render('testmatch', {
        matchning: matchingCompany.companyMatcha(req.body.job_id)
    });
})

router.post('/change_skill_student', function (req, res) {
    db.insert_studentqual(req.session.pnr, req.body.student_qual, function (err, results) {
        if (err) {
            req.flash('danger', 'The qualification already exists on this user');
            res.redirect('/profile');
        }
        else {
            req.flash('success', 'You have successfully added a qualification');
            res.redirect('/profile');
        }
    })
});
router.post('/change_skill_xjob', function (req, res) {
    db.insert_xjob_qual(req.body.job_id, req.body.xjob_qual, function (err, results) {
        if (err) {
            req.flash('danger', 'The qualification already exists on this user');
            res.redirect('/profile');
        }
        else {
            req.flash('success', 'You have successfully added a qualification');
            res.redirect('/profile');
        }
    })
});
router.post('/add_workexp', function (req, res) {
    db.insert_workexp(req.session.user, req.body.title, req.body.date, req.body.info, function (err, results) {
        if (err) {
            req.flash('danger', 'Ett fel har uppstått');
            res.redirect('/profile')
        }
        else {
            req.flash('success','Du har lagt till ett nytt jobb')
            res.redirect('/profile');
        }
    })
});
router.post('/update_workexp', function (req, res) {
    db.update_workexp(req.body.name, req.body.date, req.body.info, req.body.work_id, function (err, results) {
        if (err){
            req.flash('danger', 'Ett fel har uppstått');
            res.redirect('/profile')
        }
        else{
            req.flash('success', 'Du har ändrat ett arbete');
            res.redirect('/profile');
        }
    })
});
router.post('/delete_workexp', function (req, res) {
    db.delete_workexp(req.body.work_id, function (err, results) {
        if (err) {
            req.flash('danger', 'Ett fel har uppstått');
            res.redirect('/profile')
        }
        else {
            req.flash('success', 'Du har tagit bort ett arbete');
            res.redirect('/profile');
        }
    })
});
router.post('/add_education', function (req, res) {
    db.insert_education(req.session.user, req.body.title, req.body.date, req.body.info, function (err, results) {
        if (err) {
            req.flash('danger', 'Ett fel har uppstått');
            res.redirect('/profile')
        }
        else {
            req.flash('success', 'Du har lagt till en ny utbildning')
            res.redirect('/profile');
        }
    })
});
router.post('/delete_education', function (req, res) {
    db.delete_education(req.body.education_id, function (err, results) {
        if (err) {
            req.flash('danger', 'Ett fel har uppstått');
            res.redirect('/profile')
        }
        else {
            req.flash('success', 'Du har tagit bort en utbildning');
            res.redirect('/profile');
        }
    })
});
router.post('/update_education', function (req, res) {
    db.update_education(req.body.name, req.body.date, req.body.info, req.body.education_id, function (err, results) {
        if (err){
            req.flash('danger', 'Ett fel har uppstått');
            res.redirect('/profile')
        }
        else{
            req.flash('success', 'You have ändrat en utbildning');
            res.redirect('/profile');
        }
    })
});
module.exports = router;

