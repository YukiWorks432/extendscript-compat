(function () {
  var report = { hostVersion: app.version, engineVersion: $.version, engineBuild: $.build };
  var beforeItems = app.project.numItems,
    beforeDirty = app.project.dirty;
  var nativeValues = [];
  for (var i = 0; i < 3; i++) {
    switch (i) {
      case 1:
        continue;
      case 2:
        continue;
    }
    nativeValues.push(i);
  }
  var labeledValues = [];
  outer: for (var j = 0; j < 3; j++) {
    switch (j) {
      case 1:
        continue outer;
      case 2:
        continue outer;
    }
    labeledValues.push(j);
  }
  report.continueNative = nativeValues.join(",");
  report.continueLabeled = labeledValues.join(",");
  var snippets = [
    "var n=[];n:for(var t=0;t<3;t++){switch(t){case 1:case 2:continue n}n.push(t)}n.join(',')",
    "var n=[];n:for(var t=0;t<3;t++){switch(t){case 1:case 2:continue n;}n.push(t)}n.join(',')",
  ];
  report.continueSemicolons = [];
  for (var k = 0; k < snippets.length; k++) {
    try {
      // oxlint-disable-next-line no-eval -- 同じ入力の構文エラーと正常動作を実機で比較する。
      report.continueSemicolons.push({ value: String(eval(snippets[k])) });
    } catch (error) {
      report.continueSemicolons.push({ error: String(error) });
    }
  }
  report.regex = {
    hex: /[a\x2Dz]/.test("b"),
    unicode: /[a\u002Dz]/.test("b"),
    escaped: /[a\-z]/.test("b"),
  };
  var direct = new UnitValue("2 in");
  direct["-"] = function (operand, rev) {
    return new UnitValue(rev ? operand - this.value : this.value - operand, this.type);
  };
  var readFirst = new UnitValue("2 in"),
    saved = readFirst["-"];
  readFirst["-"] = function (operand, rev) {
    return new UnitValue(rev ? operand - this.value : this.value - operand, this.type);
  };
  report.unitOperatorOverride = {
    direct: (10 - direct).value,
    afterNativeLookup: (10 - readFirst).value,
    nativeType: typeof saved,
  };
  function subtract(left, right) {
    var value = new UnitValue(left - right.value, right.type);
    value.baseUnit = right.baseUnit;
    return value;
  }
  function isNull(value) {
    if (value instanceof UnitValue) return false;
    return value === null;
  }
  var input = new UnitValue("20 px");
  input.baseUnit = new UnitValue(1 / 96, "in");
  var result = subtract(10, input);
  report.unitSubtraction = {
    before: (10 - new UnitValue("2 in")).value,
    corrected: subtract(10, new UnitValue("2 in")).value,
    pixelValue: result.value,
    pixelInches: result.as("in"),
    inputValue: input.value,
    inputInches: input.as("in"),
  };
  report.unitNull = {
    // oxlint-disable-next-line no-constant-binary-expression -- EC-11の純正エンジンの誤比較を観測する。
    before: new UnitValue("0.5 in") === null,
    corrected: isNull(new UnitValue("0.5 in")),
    actualNull: isNull(null),
  };
  report.projectPreserved =
    app.project.numItems === beforeItems && app.project.dirty === beforeDirty;
  return report;
})();
