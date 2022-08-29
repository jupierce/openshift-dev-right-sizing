function onFormSubmit(e) {
  const IDX_USE_CASE_DESC = 1;
  const IDX_CLOUD_NAME = 2;
  const IDX_NEED_MULTI_AZ = 3;
  const IDX_CPU_COUNT = 4;
  const IDX_BURSTABLE = 5;
  const IDX_SPOT_INSTANCES = 6;
  const IDX_WORKER_COUNT = 7;
  const IDX_EMAIL_ADDRESS = 8;

  let useCase = e.values[IDX_USE_CASE_DESC];
  let emailAddress = e.values[IDX_EMAIL_ADDRESS];
  let cloudName = e.values[IDX_CLOUD_NAME];
  let needsMultiAZ = e.values[IDX_NEED_MULTI_AZ] == 'Yes';
  let cpuCount = 2;
  if (e.values[IDX_CPU_COUNT].startsWith("4")) {
    cpuCount = 4;
  }

  let canBeBurstable = e.values[IDX_BURSTABLE].indexOf("idle") > -1;
  let canBeSpotInstances = e.values[IDX_SPOT_INSTANCES].indexOf('Yes') > -1;
  let workerCount = parseInt("" + e.values[IDX_WORKER_COUNT], 10);

  let mods = []
 
  var controlFamilyBase
  var controlSuffix
  var computeFamilyBase
  var computeSuffix
  var cloudShortName

  if (cloudName.indexOf('AWS') > -1) {
    cloudShortName = "aws"
    controlFamilyBase = "m6i"
    controlSuffix = ".xlarge"

    computeFamilyBase = "m6i"
    if (cloudName.indexOf('us-east-1') > -1) {
      // preferred region with m6a machines
      controlFamilyBase = "m6a"
      computeFamilyBase = "m6a"
      if (canBeBurstable) {
        computeFamilyBase = "t3a"
      }
    }
    
    computeSuffix = ".large"
    if (cpuCount > 2) {
      computeSuffix = ".xlarge"
    }

    if (!needsMultiAZ) {
      // AWS region name like "us-east-1" to AZ name like "us-east-1a"
      mods.push(`.controlPlane.platform.${cloudShortName}.zones = [ .platform.${cloudShortName}.region + "a" ]`)
      mods.push(`.compute[0].platform.${cloudShortName}.zones = [ .platform.${cloudShortName}.region + "a" ]`)
    }

  } else {
    // GCP
    cloudShortName = "gcp"
    controlFamilyBase = "n1-standard"
    controlSuffix = "-4"

    computeFamilyBase = "n1-standard"

    computeSuffix = "-2"
    if (cpuCount > 2) {
      computeSuffix = "-4"
    }

    if (!needsMultiAZ) {
      // GCP region name like "us-east1" to AZ name like "us-east1-a"
      mods.push(`.controlPlane.platform.${cloudShortName}.zones = [ .platform.${cloudShortName}.region + "-a" ]`)
      mods.push(`.compute[0].platform.${cloudShortName}.zones = [ .platform.${cloudShortName}.region + "-a" ]`)
    }

  }

  mods.push(`.controlPlane.platform.${cloudShortName}.type = "${controlFamilyBase + controlSuffix}"`)  
  mods.push(`.compute[0].platform.${cloudShortName}.type = "${computeFamilyBase + computeSuffix}"`)  
  mods.push(`.compute[0].replicas = ${workerCount}`)

  htmlBody = `
  <p>
  Please use the following instructions to setup a cost effective cluster in the openshift-dev environment based on your 
  form responses:
  </p>

  <p>
    <b>Submitted use case:</b><br>
    <p style="background-color:#E6EDf5; margin-left:2em; margin-right:2em; padding:1em;">
    ${useCase}
    </p>
  </p>
  
  <p>
    <b>Pre-Install setup:</b>
    <ul>
      <li><a href="https://mirror.openshift.com/pub/openshift-v4/x86_64/clients/ocp/">Download</a> the OpenShift installer</li>
      <li>Install the <a href="https://github.com/mikefarah/yq/releases/tag/v4.27.2">golang based yq on the system from which you will run openshift-install.</li>
    </ul>
  </p>

  <p>
    <b>Create an installation configuration file</b> (<a href="https://docs.openshift.com/container-platform/4.11/installing/installing_aws/installing-aws-customizations.html#installation-initializing_installing-aws-customizations">docs</a>)<b>:</b>
<pre style="font-family: monospace; background-color:#E6EDf5; margin-left:2em; margin-right:2em; padding:1em;">
export install_dir=&lt;installation directory to create&gt;
</pre>
<pre style="font-family: monospace; background-color:#E6EDf5; margin-left:2em; margin-right:2em; padding:1em;">
./openshift-install create install-config --dir $install_dir
</pre>
  </p>  

  <p>
    <b>Modify install-config.yaml:</b>
    In the installation configuration directory created by "create install-config", run the following yq command:
<pre style="font-family: monospace; background-color:#E6EDf5; margin-left:2em; margin-right:2em; padding:1em;">
yq -i '${mods.join(" | ")}' $install_dir/install-config.yaml
</pre>
  </p>

`
  if (canBeSpotInstances) {
    htmlBody += `
  <p>
    <b>Render the installation manifests:</b>
<pre style="font-family: monospace; background-color:#E6EDf5; margin-left:2em; margin-right:2em; padding:1em;">
./openshift-install create manifests --dir $install_dir
</pre>
  </p>

  <p>
    <b>Enable Spot instances:</b>
<pre style="font-family: monospace; background-color:#E6EDf5; margin-left:2em; margin-right:2em; padding:1em;">
for MACHINESET_FILE in $install_dir/openshift/99_openshift-cluster-api_worker-machineset-*.yaml; do
  yq -i '.spec.template.spec.providerSpec.spotMarketOptions = {}' $MACHINESET_FILE
done
</pre>
  </p>
`
  } 

  htmlBody += `
  <p>
    <b>Trigger the cluster installation:</b>
<pre style="font-family: monospace; background-color:#E6EDf5; margin-left:2em; margin-right:2em; padding:1em;">
./openshift-install create cluster --dir $install_dir --log-level=info
</pre>
  </p>
`

  GmailApp.sendEmail(emailAddress, "OpenShift-Dev Cost Effective Install Guide", "HTML email client is required.", {
    htmlBody: htmlBody,
    noReply: true
  })

}

/**
 * Test function for Spreadsheet Form Submit trigger functions.
 * Loops through content of sheet, creating simulated Form Submit Events.
 *
 * Check for updates: https://stackoverflow.com/a/16089067/1677912
 *
 * See https://developers.google.com/apps-script/guides/triggers/events#google_sheets_events
 */
function test_onFormSubmit() {
  const dataRange = SpreadsheetApp.getActiveSheet().getDataRange();
  const data = dataRange.getValues();
  const headers = data[0];
  
  // Start at row 1, skipping headers in row 0
  for (var row=1; row < data.length; row++) {
    let e = {};
    e.values = data[row].filter(Boolean);  // filter: https://stackoverflow.com/a/19888749
    e.range = dataRange.offset(row,0,1,data[0].length);
    e.namedValues = {};
    // Loop through headers to create namedValues object
    // NOTE: all namedValues are arrays.
    for (let col=0; col<headers.length; col++) {
      e.namedValues[headers[col]] = [data[row][col]];
    }
    // Pass the simulated event to onFormSubmit
    onFormSubmit(e);
  }
}
