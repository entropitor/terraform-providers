VERSION:=1.0.0
OS:=darwin
ARCH:=arm64

HOSTNAME:=localhost\:8000
NAMESPACE:=edu
NAME:=hashicups

RELEASE_DIR:=dist/releases
VERSION_RELEASE_DIR:=${RELEASE_DIR}/${VERSION}

KEY_ID:="E72A054EBE968000FF00A7E47EF397EA8236B213"

dist/fsmirror/${HOSTNAME}/${NAMESPACE}/${NAME}/terraform-provider-${NAME}_${VERSION}_${OS}_${ARCH}.zip: ${VERSION_RELEASE_DIR}/terraform-provider-${NAME}_${VERSION}_${OS}_${ARCH}.zip
	mkdir -p $$(dirname $@)
	cp $< $@

${VERSION_RELEASE_DIR}/terraform-provider-${NAME}_${VERSION}_${OS}_${ARCH}.zip: dist/terraform-provider-${NAME}_${VERSION}
	mkdir -p $$(dirname $@)
	zip -jr $@ $<

dist/terraform-provider-${NAME}_${VERSION}: src/terraform-provider-${NAME}.ts
	bun build $< --compile --outfile $@

clean:
	rm -rf dist/

${VERSION_RELEASE_DIR}/terraform-provider-${NAME}_${VERSION}_SHA256SUMS: ${VERSION_RELEASE_DIR}/terraform-provider-${NAME}_${VERSION}_${OS}_${ARCH}.zip
	cd ${VERSION_RELEASE_DIR} && shasum -a 256 terraform-provider-${NAME}_${VERSION}*.zip > terraform-provider-${NAME}_${VERSION}_SHA256SUMS

${VERSION_RELEASE_DIR}/terraform-provider-${NAME}_${VERSION}_SHA256SUMS.sig: ${VERSION_RELEASE_DIR}/terraform-provider-${NAME}_${VERSION}_SHA256SUMS
	gpg --default-key ${KEY_ID} --detach-sign $<

${VERSION_RELEASE_DIR}/terraform-provider-${NAME}_${VERSION}_manifest.json:
	echo '{ "version": 1, "metadata": { "protocol_versions": ["6.7"] } } ' > $@

release: ${VERSION_RELEASE_DIR}/terraform-provider-${NAME}_${VERSION}_SHA256SUMS.sig ${VERSION_RELEASE_DIR}/terraform-provider-${NAME}_${VERSION}_manifest.json ${RELEASE_DIR}/armor.gpg

${RELEASE_DIR}/armor.gpg:
	gpg --armor --export ${KEY_ID} > $@
