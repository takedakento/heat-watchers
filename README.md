### Project structure

```
heat-wachers
├── README.md
├── data
│   ├── exposure_degree20.geojson   # Heat exposure data
│   └── pca_vuln_index.geojson      # Heat vulnerability data
├── index.html
└── js
    └── script.js
```
### Project URL & Screencast Video
#### Final project URL
```
https://heatwatchers.org/
```
#### Screencast Video
```
https://utoronto-my.sharepoint.com/:v:/r/personal/xunlily_li_mail_utoronto_ca/Documents/Microsoft%20Teams%20Chat%20Files/Hearwatchers2.mp4?csf=1&web=1&e=7Sklvh
```

### How to run

#### With Python

```
% python3 -m http.server 8000
```

Then, open `http://localhost:8000` in your browser.

#### With Node.js

```
% npx http-server
```

### Data preparation steps for members

To visualize heat vulnerability, we start with `pca_vuln_index.shp` (Heat Vulnerability Index, PCA Method). This file contains dissemination areas (DAs) in Toronto, each with a heat vulnerability score. The score is derived from sensitivity, exposure, and adaptive capacity factors using PCA. Higher scores mean more vulnerable areas (e.g., low-income, less tree cover, high heat exposure).

Below, I will provide rough instructions for preparing the data on macOS.

1. Obtain the dataset.

    ```
    % git clone https://github.com/Moraine729/Toronto_Heat_Vulnerability.git
    % cd Toronto_Heat_Vulnerability/Results
    % unzip pca_vuln_index.zip
    ```

2. Convert to GeoJSON.

    ```
    % ogr2ogr -f GeoJSON -t_srs EPSG:4326 pca_vuln_index.geojson pca_vuln_index.shp
    ```

3. Rename the vulnerability column `"std_pc2"` to `"Heat_Vuln"` by running this Python script:

    ```python
    import json

    with open("pca_vuln_index.geojson", "r") as f:
        data = json.load(f)

    for feature in data["features"]:
        feature["properties"]["Heat_Vuln"] = feature["properties"].pop("std_pc2")

    with open("pca_vuln_index_fixed.geojson", "w") as f:
        json.dump(data, f)
    ```

4. A correctly formatted GeoJSON file should look like this:

    ```
    {
      "type": "FeatureCollection",
      "name": "pca_vuln_index",
      "crs": {
        "type": "name",
        "properties": {
          "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
        }
      },
      "features": [
        {
          "type": "Feature",
          "properties": {
            "DAUID": 35201588,
            "DA_area": 94828.9235104,
            "vuln_pc2": -0.418767456284072,
            "Heat_Vuln": 0.448212817190046
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  -79.54524684718007,
                  43.601691363894844
                ],
    ...
    ```

5. If the GeoJSON looks correct, you can start visualizing it in D3.js.
