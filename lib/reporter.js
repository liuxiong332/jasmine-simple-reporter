var util = require('util')

var ANSIColors = {
    pass:    function() { return "\033[32m"; }, // Green
    fail:    function() { return '\033[31m'; }, // Red
    specTiming:  function()  { return '\033[34m'; }, // Blue
    suiteTiming:  function() { return '\033[33m'; }, // Yelow
    ignore:  function() { return '\033[37m'; }, // Light Gray
    neutral: function() { return '\033[0m';  }  // Normal
};

var NoColors = {
    pass:    function() { return ''; },
    fail:    function() { return ''; },
    specTiming:  function() { return ''; },
    suiteTiming: function() { return ''; },
    ignore:  function() { return ''; },
    neutral: function() { return ''; }
};

var TerminalReporter = function(config) {
  this.print_ = config.print || function (str) { process.stdout.write(util.format(str)); };
  this.color_ = config.color ? ANSIColors : NoColors;

  this.started_ = false;
  this.finished_ = false;

  this.callback_ = config.onComplete || false

  this.suites_ = [];
  this.specResults_ = {};
  this.failures_ = [];
  this.includeStackTrace_ = config.includeStackTrace === false ? false : true;
  this.stackFilter_ = config.stackFilter || function(t) { return t; };
}

TerminalReporter.prototype.reportRunnerStarting = function(runner) {
  this.started_ = true;
  this.startedAt = new Date();
  var suites = runner.topLevelSuites();
  for (var i = 0; i < suites.length; i++) {
    var suite = suites[i];
    this.suites_.push(this.summarize_(suite));
  }
};

TerminalReporter.prototype.summarize_ = function(suiteOrSpec) {
  var isSuite = suiteOrSpec instanceof jasmine.Suite;

  // We could use a separate object for suite and spec
  var summary = {
    id: suiteOrSpec.id,
    name: suiteOrSpec.description,
    type: isSuite? 'suite' : 'spec',
    suiteNestingLevel: 0,
    children: []
  };

  if (isSuite) {
    var calculateNestingLevel = function(examinedSuite) {
      var nestingLevel = 0;
      while (examinedSuite.parentSuite !== null) {
        nestingLevel += 1;
        examinedSuite = examinedSuite.parentSuite;
      }
      return nestingLevel;
    };

    summary.suiteNestingLevel = calculateNestingLevel(suiteOrSpec);

    var children = suiteOrSpec.children;
    for (var i = 0; i < children.length; i++) {
      summary.children.push(this.summarize_(children[i]));
    }
  }

  return summary;
};

// This is heavily influenced by Jasmine's Html/Trivial Reporter
TerminalReporter.prototype.reportRunnerResults = function(runner) {
  this.reportFailures_();

  var results = runner.results();
  var resultColor = (results.failedCount > 0) ? this.color_.fail() : this.color_.pass();

  var specs = runner.specs();
  var specCount = specs.length;

  var message = "\n\nFinished in " + ((new Date().getTime() - this.startedAt.getTime()) / 1000) + " seconds";
  this.printLine_(message);

  // This is what jasmine-html.js has
  //message = "" + specCount + " spec" + ( specCount === 1 ? "" : "s" ) + ", " + results.failedCount + " failure" + ((results.failedCount === 1) ? "" : "s");

  this.printLine_(this.stringWithColor_(this.printRunnerResults_(runner), resultColor));

  this.finished_ = true;
  if(this.callback_) { this.callback_(runner); }
};

TerminalReporter.prototype.reportFailures_ = function() {
  if (this.failures_.length === 0) {
    return;
  }

  var indent = '  ', failure;
  this.printLine_('\n');

  this.print_('Failures:');

  for (var i = 0; i < this.failures_.length; i++) {
    failure = this.failures_[i];
    this.printLine_('\n');
    this.printLine_('  ' + (i + 1) + ') ' + failure.spec);
    this.printLine_('   Message:');
    this.printLine_('     ' + this.stringWithColor_(failure.message, this.color_.fail()));
    if (this.includeStackTrace_) {
        this.printLine_('   Stacktrace:');
        this.print_('     ' + this.stackFilter_(failure.stackTrace));
    }
  }
};

TerminalReporter.prototype.reportSuiteResults = function(suite) {
  // Not used in this context
};

TerminalReporter.prototype.reportSpecResults = function(spec) {
  var result = spec.results();
  var msg = '';
  if (result.skipped) {
    msg = this.stringWithColor_('-', this.color_.ignore());
  } else if (result.passed()) {
    msg = this.stringWithColor_('.', this.color_.pass());
  } else {
    msg = this.stringWithColor_('F', this.color_.fail());
    this.addFailureToFailures_(spec);
  }
  this.spec_results += msg;
  this.print_(msg);
};

TerminalReporter.prototype.addFailureToFailures_ = function(spec) {
  var result = spec.results();
  var failureItem = null;

  var items_length = result.items_.length;
  for (var i = 0; i < items_length; i++) {
    if (result.items_[i].passed_ === false) {
      failureItem = result.items_[i];

      var failure = {
        spec: spec.suite.getFullName() + " " + spec.description,
        message: failureItem.message,
        stackTrace: failureItem.trace.stack
      }

      this.failures_.push(failure);
    }
  }
};

TerminalReporter.prototype.printRunnerResults_ = function(runner){
  var results = runner.results();
  var specs = runner.specs();
  var msg = '';
  var skippedCount = 0;
  specs.forEach(function(spec) {
    if (spec.results().skipped) {
      skippedCount++;
    }
  });
  var passedCount = specs.length - skippedCount;
  msg += passedCount + ' test' + ((passedCount === 1) ? '' : 's') + ', ';
  msg += results.totalCount + ' assertion' + ((results.totalCount === 1) ? '' : 's') + ', ';
  msg += results.failedCount + ' failure' + ((results.failedCount === 1) ? '' : 's') + ', ';
  msg += skippedCount + ' skipped' + '\n';
  return msg;
},

// Helper Methods //
TerminalReporter.prototype.stringWithColor_ = function(stringValue, color) {
  return (color || this.color_.neutral()) + stringValue + this.color_.neutral();
},

TerminalReporter.prototype.printLine_ = function(stringValue) {
  this.print_(stringValue);
  this.print_('\n');
}

// ***************************************************************
// TerminalVerboseReporter uses the TerminalReporter's constructor
// ***************************************************************
var TerminalVerboseReporter = function(config) {
  TerminalReporter.call(this, config);
  // The extra field in this object
  this.indent_ = 0;
  this.specTimes_ = {};
  this.suiteTimes_ = {};
  this.suiteResults_ = {};
}

// Inherit from TerminalReporter
util.inherits(TerminalVerboseReporter, TerminalReporter);

verboseReporterProto = TerminalVerboseReporter.prototype;
verboseReporterProto.reportSpecStarting = function(spec) {
    now = new Date().getTime();
    this.specTimes_[spec.id] = now;
    var suite = spec.suite;
    while (suite) {
        if (!this.suiteTimes_[suite.id]) {
            this.suiteTimes_[suite.id] = now;
        }
        suite = suite.parentSuite;
    }
};

verboseReporterProto.reportSpecResults = function(spec) {
  var elapsed = new Date().getTime() - this.specTimes_[spec.id];

  if (spec.results().failedCount > 0) {
    this.addFailureToFailures_(spec);
  }

  this.specResults_[spec.id] = {
    messages: spec.results().getItems(),
    result: spec.results().failedCount > 0 ? 'failed' : 'passed',
    runtime: elapsed
  };
};

verboseReporterProto.reportSuiteResults = function(suite) {
    var startTime = this.suiteTimes_[suite.id];
    if (startTime) {
        var elapsed = new Date().getTime() - startTime;
        this.suiteResults_[suite.id] = {
            runtime: elapsed
        };
    }
};

verboseReporterProto.reportRunnerResults = function(runner) {
  var messages = new Array();
  this.buildMessagesFromResults_(messages, this.suites_);

  var messages_length = messages.length;
  for (var i = 0; i < messages_length-1; i++) {
    this.printLine_(messages[i]);
  }

  this.print_(messages[messages_length-1]);

  // Call the parent object's method
  TerminalReporter.prototype.reportRunnerResults.call(this, runner);
};

verboseReporterProto.buildMessagesFromResults_ = function(messages, results, depth) {
  var element, specResult, specIndentSpaces, msg = '';
  depth = (depth === undefined) ? 0 : depth;

  var results_length = results.length;
  for (var i = 0; i < results_length; i++) {
    element = results[i];

    if (element.type === 'spec') {
      specResult = this.specResults_[element.id.toString()];

      if (specResult.result === 'passed') {
        msg = this.stringWithColor_(this.indentMessage_(element.name, depth), this.color_.pass());
      } else {
        msg = this.stringWithColor_(this.indentMessage_(element.name, depth), this.color_.fail());
      }
      msg += this.stringWithColor_(" - " + specResult.runtime + " ms",
                                   this.color_.specTiming());

      messages.push(msg);
    } else {
      messages.push('');
      msg = this.indentMessage_(element.name, depth)
      if (element.id != null) {
          suiteResult = this.suiteResults_[element.id.toString()];
          if (suiteResult) {
              msg += this.stringWithColor_(" - " + suiteResult.runtime + " ms", this.color_.suiteTiming());
          }
      }
      messages.push(msg);
    }

    this.buildMessagesFromResults_(messages, element.children, depth + 2);
  }
};

verboseReporterProto.indentMessage_ = function(message, indentCount) {
  var _indent = '';
  for (var i = 0; i < indentCount; i++) {
    _indent += '  ';
  }
  return (_indent + message);
};

module.exports = {
  TerminalReporter: TerminalReporter,
  TerminalVerboseReporter: TerminalVerboseReporter,
};
